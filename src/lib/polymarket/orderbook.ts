type BookLevel = { price: string; size: string };
type BookLike = {
  bids?: BookLevel[];
  asks?: BookLevel[];
};

function parsePrice(level?: BookLevel) {
  return Number(level?.price ?? NaN);
}

export function getBestBidLevel(book?: BookLike) {
  return book?.bids?.reduce<BookLevel | undefined>((best, level) => {
    if (!best) {
      return level;
    }
    return parsePrice(level) > parsePrice(best) ? level : best;
  }, undefined);
}

export function getBestAskLevel(book?: BookLike) {
  return book?.asks?.reduce<BookLevel | undefined>((best, level) => {
    if (!best) {
      return level;
    }
    return parsePrice(level) < parsePrice(best) ? level : best;
  }, undefined);
}
