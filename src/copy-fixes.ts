// Copy fixes for design exports: exact text swaps the router makes inside a
// page's template (src/bundle.ts applyCopyFixes) before serving it.
//
// Use them when an exported page says something wrong and the fix can't wait
// for the canvas to be edited and re-exported. Each `from` must match the
// export's markup exactly (curly quotes, tags and all); a fix whose `to` is
// already in the page counts as applied, so fixing the canvas later is safe.
// The edge function reports "applied/total" in the X-Kept-Copy-Fixes header,
// and the page checks fail if any fix stops matching or a `gone` phrase shows.

export type CopyFix = readonly [from: string, to: string];
export type PageCopyFixes = {
  why: string;
  // Phrases that must not appear anywhere in the rendered page (case-insensitive).
  gone: string[];
  fixes: CopyFix[];
};

export const COPY_FIXES: Record<string, PageCopyFixes> = {
  // Nov 17, 2026 (Cody): this page's copy came from /gift-new-mom and talked
  // about a newborn. Rewritten for someone buying for parents of older kids
  // (a daughter, son, sister or friend whose kids are past the baby stage).
  // Reviews stay verbatim; the four cards and two pull quotes about babies
  // were swapped for verified 5-star reviews about gifts to a wife, daughter,
  // sister or best friend. The canvas still has the old copy.
  "gift-older-kids": {
    why: "Copied from the new-mom gift page; written for a gift to parents of older kids",
    gone: ["ready the day the baby arrives", "new mom", "She picks", "next shower", "Every baby (and their mom)", "suits her", "FALL SALE"],
    fixes: [
      // design bar line 1 (hidden by the offer bar, but stale)
      [">FALL SALE!</p>",
        ">BLACK FRIDAY SALE IS LIVE!</p>"],
      // design bar line 3
      ["📚 25% OFF 2+ BOOKS (CODE: <span style=\"text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:1px\">KEPT25</span>)</p>",
        "📚 25% OFF 2+ BOOKS WITH CODE <span style=\"text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:1px\">KEPT25</span></p>"],
      // proof bar under the rating
      ["From new moms and gift-givers",
        "From parents and gift-givers"],
      // What’s inside: headline
      ["You pick the gift. She picks what’s worth remembering.",
        "You pick the gift. They pick what’s worth remembering."],
      // What’s inside 02
      ["the cute things they said. She can circle one, write a line, or tell the whole story.",
        "the cute things the kids said. Circle one, write a line, or tell the whole story."],
      // What’s inside 03 eyebrow
      ["03 · On her schedule",
        "03 · On their schedule"],
      // What’s inside 03 headline
      ["Ten minutes, when she has them.",
        "Ten minutes, when they have them."],
      // What’s inside 03 body
      ["She writes when there’s a minute, and the book waits for her.",
        "They write when there’s a minute, and the book waits."],
      // Less statistics: body
      ["Most baby books hand a new mom a list of stats to keep up with. This one leaves the numbers out and goes straight to the things she’ll want to remember: what made them laugh,",
        "Most baby books hand parents a list of stats to keep up with. This one leaves the numbers out and goes straight to the things worth remembering: what made the kids laugh,"],
      // Less statistics: pull quote (was Emily, “the new parents”; now Annette, verified)
      ["“Felt happy to gift something that would certainly be used that also didn’t demand too much time from the new parents.”</p>\n        <p class=\"eb\" style=\"color:#ffffff\">Emily · Verified review</p>",
        "“Gave this to my daughter for each of her children. She was so thrilled with the gift that it brought her to tears.”</p>\n        <p class=\"eb\" style=\"color:#ffffff\">Annette · Verified review</p>"],
      // Reviews: headline
      ["They gave it to a new mom. Here’s how it went.",
        "They gave it to a daughter, a sister, a friend. Here’s how it went."],
      // Reviews: card (was Jana, grandbaby born; now Abby, verified)
      ["<h3 class=\"disp\" style=\"font-size:22px\">For my grandchild</h3>\n          <p class=\"body\" style=\"font-size:15px\">I gave this lovely book to my son and daughter-in-law the day my grandbaby was born and they LOVED it! So elegant, so unique and classy. They immediately began to fill it in.</p>\n          <p class=\"eb\" style=\"margin-top:auto;padding-top:8px\">Jana · Verified review</p>",
        "<h3 class=\"disp\" style=\"font-size:22px\">Love it!</h3>\n          <p class=\"body\" style=\"font-size:15px\">I love mine so much I got one for my sister.</p>\n          <p class=\"eb\" style=\"margin-top:auto;padding-top:8px\">Abby · Verified review</p>"],
      // Reviews: card (was Patricia, sister-in-law expecting; now Linda, verified)
      ["<h3 class=\"disp\" style=\"font-size:22px\">Best gift for SIL</h3>\n          <p class=\"body\" style=\"font-size:15px\">I bought this book for my sister in law who is expecting her first baby. She absolutely loved it, I’m pretty sure it was her favorite gift! I’ll hopefully buy a copy for myself some day.</p>\n          <p class=\"eb\" style=\"margin-top:auto;padding-top:8px\">Patricia</p>",
        "<h3 class=\"disp\" style=\"font-size:22px\">My daughter loved it!</h3>\n          <p class=\"body\" style=\"font-size:15px\">I bought two of these books for my daughter for Mother’s Day and she absolutely loved them. The colors were beautiful, the quality of the product was excellent! I would absolutely recommend these for journaling for your child’s life events.</p>\n          <p class=\"eb\" style=\"margin-top:auto;padding-top:8px\">Linda · Verified review</p>"],
      // Reviews: card (was Sheena, baby showers; now Lillian, verified)
      ["<h3 class=\"disp\" style=\"font-size:22px\">The shower gift from here on out</h3>\n          <p class=\"body\" style=\"font-size:15px\">A beautiful book! Great website &amp; quick delivery experience! I will be purchasing these for baby shower gifts from here on out. I don’t know why I ever bought anything else as gifts for baby showers!</p>\n          <p class=\"eb\" style=\"margin-top:auto;padding-top:8px\">Sheena</p>",
        "<h3 class=\"disp\" style=\"font-size:22px\">The perfect “baby” book</h3>\n          <p class=\"body\" style=\"font-size:15px\">I have now bought these for my best friend, my brother, and myself. These are perfect!</p>\n          <p class=\"eb\" style=\"margin-top:auto;padding-top:8px\">Lillian · Verified review</p>"],
      // Reviews: card (was Emily, first-time mom; now Carol, verified)
      ["<h3 class=\"disp\" style=\"font-size:22px\">Perfect gift for mom to be</h3>\n          <p class=\"body\" style=\"font-size:15px\">Bought this as a gift for my sister who is becoming a first time mom. It’s beautiful, and while I didn’t think she’d be super into a traditional style baby book, this speaks to what she values and I believe it will be something she can easily stick to and create something to be shared with her daughter as she grows up.</p>\n          <p class=\"eb\" style=\"margin-top:auto;padding-top:8px\">Emily · Verified review</p>",
        "<h3 class=\"disp\" style=\"font-size:22px\">I bought these books as a gift for my daughter</h3>\n          <p class=\"body\" style=\"font-size:15px\">I bought these books as a gift for my daughter. They were on her wishlist and we love them. They are so beautiful and the embossed names turned out so well. She will enjoy filling them out and will treasure them for years to come.</p>\n          <p class=\"eb\" style=\"margin-top:auto;padding-top:8px\">Carol · Verified review</p>"],
      // Gifting more than one: headline
      ["One for her. One for the next shower.",
        "One for each kid."],
      // Gifting more than one: body
      ["A lot of the people who give it once end up giving it again: to a sister, a best friend, or the next time a baby comes into the family. Two or more books are 25% off, and each one can carry its own name.",
        "Most families have more than one kid to start a book for. Give one to each, so every kid gets their own pages and their own name on the cover. Two or more books are 25% off."],
      // Gifting more than one: pull quote (was Lexus, “every baby”; now Samuel, verified)
      ["“Every baby (and their mom) in our lives are gifted a Kept book.”</p>\n        <p class=\"eb\">Lexus · Verified review</p>",
        "“Bought this book for my wife for each of our kids.”</p>\n        <p class=\"eb\">Samuel · Verified review</p>"],
      // FAQ: will they use it (question)
      ["<summary>Will she actually use it?</summary>",
        "<summary>Will they actually use it?</summary>"],
      // FAQ: will they use it (answer)
      ["the cute things they said. Realistically, she can pick it up",
        "the cute things the kids said. Realistically, they can pick it up"],
      // FAQ: name on the cover (question)
      ["<summary>What if they haven’t picked a name yet?</summary>",
        "<summary>Can each kid have their own name on the cover?</summary>"],
      // FAQ: name on the cover (answer)
      ["The name on the cover is optional. Order it plain and it’s ready the day the baby arrives. If you know the name, it’s imprinted on the linen, up to ten characters, for $20 a book. Or send a <a href=\"https://keptcollection.com/products/kept-gift-card\" style=\"text-underline-offset:3px\">Kept digital gift card</a> and she can pick the color and add the name herself.",
        "Yes. Each kid can have their own book with their own name, imprinted on the linen, up to ten characters, for $20 a book. The name is optional, and imprinted books take an extra 5–7 business days before they ship. Or send a <a href=\"https://keptcollection.com/products/kept-gift-card\" style=\"text-underline-offset:3px\">Kept digital gift card</a> and they can pick the colors and add the names themselves."],
      // FAQ: already have a baby book (question)
      ["<summary>What if she already has a baby book?</summary>",
        "<summary>What if they already have a baby book?</summary>"],
      // FAQ: already have a baby book (answer)
      ["so it picks up where a first-year book leaves off and keeps going.",
        "so it picks up wherever their kids are now and keeps going."],
      // FAQ: photos (answer)
      ["It’s built for writing down the things she’ll want to remember. There are blank pages at the end of each year that fit a few Polaroids or mini prints, if she’d like to add them.",
        "It’s built for writing down the things worth remembering. There are blank pages at the end of each year that fit a few Polaroids or mini prints, if they’d like to add them."],
      // FAQ: not right for them (question)
      ["<summary>What if it isn’t right for her?</summary>",
        "<summary>What if it isn’t right for them?</summary>"],
      // Name on the cover: body
      ["Pick the color that suits her. Add the baby’s name to the linen, up to ten characters, or leave it plain until they’re here.",
        "Pick a color for each kid. Add their name to the linen, up to ten characters, or leave it plain."],
    ],
  },
};
