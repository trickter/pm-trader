"use server";

import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";

import { verifyAdminToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { cancelAllOrders, placeLimitOrder } from "@/lib/polymarket/clob-trading";
import { setupManualOrder } from "@/lib/orders/manual";
import { audit } from "@/lib/risk/engine";
import { StrategySide } from "@prisma/client";

function redirectToMarketOrderResult(
  marketId: string,
  status: "dry_run" | "submitted" | "rejected" | "error",
  detail?: string,
) {
  const params = new URLSearchParams({ orderStatus: status });
  if (detail) {
    params.set("orderDetail", detail);
  }
  redirect(`/markets/${marketId}?${params.toString()}`);
}

export async function placeManualOrderAction(formData: FormData) {
  if (!(await verifyAdminToken())) {
    throw new Error("Unauthorized");
  }

  const marketId = String(formData.get("marketId"));
  const tokenId = String(formData.get("tokenId"));
  const side = String(formData.get("side")) as StrategySide;
  const size = Number(formData.get("size"));
  const price = Number(formData.get("price"));

  const { runtime, market, localOrder } = await setupManualOrder({
    marketId,
    tokenId,
    side,
    size,
    price,
  });

  if (runtime.defaultDryRun) {
    await finalizeManualOrderAction(marketId, localOrder.id, runtime.defaultDryRun);
    redirectToMarketOrderResult(marketId, "dry_run", localOrder.id);
  } else {
    try {
      const response = await placeLimitOrder({
        tokenId,
        side,
        size,
        price,
        tickSize: String(market.orderPriceMinTickSize ?? "0.001") as "0.1" | "0.01" | "0.001" | "0.0001",
        negRisk: Boolean(market.negRisk),
      });

      await db.order.update({
        where: { id: localOrder.id },
        data: {
          polymarketOrderId: response.orderID ?? null,
          rawResponse: response,
          status: response.success ? "SUBMITTED" : "REJECTED",
          errorMessage: response.success ? null : response.errorMsg ?? null,
        },
      });

      await finalizeManualOrderAction(marketId, localOrder.id, runtime.defaultDryRun);
      redirectToMarketOrderResult(
        marketId,
        response.success ? "submitted" : "rejected",
        response.success ? (response.orderID ?? localOrder.id) : (response.errorMsg ?? "Order rejected"),
      );
    } catch (err) {
      if (isRedirectError(err)) {
        throw err;
      }

      const errorMessage = err instanceof Error ? err.message : String(err);
      await db.order.update({
        where: { id: localOrder.id },
        data: {
          status: "REJECTED",
          errorMessage,
          rawResponse: { error: errorMessage },
        },
      });

      await finalizeManualOrderAction(marketId, localOrder.id, runtime.defaultDryRun);
      redirectToMarketOrderResult(marketId, "error", errorMessage);
    }
  }
}

export async function cancelAllOrdersAction() {
  if (!(await verifyAdminToken())) {
    throw new Error("Unauthorized");
  }

  await cancelAllOrders();
  await audit("cancel_all_orders", "Order", undefined, undefined, "operator");
  revalidatePath("/orders");
  revalidatePath("/risk");
}

async function finalizeManualOrderAction(marketId: string, orderId: string, dryRun: boolean) {
  await audit("manual_order_submitted", "Order", orderId, { dryRun }, "operator");
  revalidatePath("/orders");
  revalidatePath(`/markets/${marketId}`);
}
