/**
 * THE DEMO TOUR SCRIPT. Rewrite the lines or the steps here; nothing else needs to change.
 *
 * Mo presents the app while it is used for real, on the local demo data from `npm run demo:reset`.
 * Each scene starts by signing in the right person off camera, so any scene can be started on its own:
 *   http://localhost:3000/app?tour=1               the whole tour (press Enter to start)
 *   http://localhost:3000/app?tour=1&scene=sale    from that scene on
 * Space pauses, Esc stops.
 *
 * Steps (see steps.ts):
 *   say("…", { spotlight: "name" })   Mo talks; optionally highlights a part of the screen
 *   click("name", { match: "words" }) the cursor clicks it (match picks the one with those words)
 *   type("name", "text", { clear: true })
 *   choose("name", "Option label")     a dropdown
 *   press("name")                      Enter in that field (sends a search form)
 *   goto("/app/…"), wait(ms), waitFor("name"), wave(), signInAs("kemi")
 * "name" is a data-tour="…" attribute on the page (search the code for data-tour to see them all).
 *
 * The data the lines talk about (from scripts/demo-setup.mjs and the seed):
 *   Kemi Adebayo, owner · Ada Nwosu (PIN 2580) and Bisi Lawal, cashiers at Shop 1
 *   Amaka Obi, 0803 555 0142, bought a Centre Rug – Turkey 4 × 6 (₦70,000) yesterday at Shop 1
 *   Shop 1 has 1 laundry basket left (reorder level 3); Warehouse B has 30
 */
import { choose, click, goto, press, say, scene, signInAs, type, wait, waitFor, wave, type Pace } from "./steps";

export const pace: Pace = {
  charsPerSecond: 32,
  minReadMs: 1800,
  readMsPerChar: 32,
  cursorMs: 800,
  typingMs: 75,
  afterActionMs: 800,
};

export const scenes = [
  scene("welcome", "Welcome and overview", [
    signInAs("kemi"),
    goto("/app"),
    waitFor("dash-today"),
    wave(),
    say("Hello! I'm Mo. Let me show you how Modasa runs its shops and warehouses from one screen."),
    say("This is the owner's home page. Today's sales across every shop, live as they happen.", {
      spotlight: "dash-today",
    }),
    say("Each shop at a glance: how many sales, the takings, and whether the till is open.", {
      spotlight: "dash-shops",
    }),
    say("And anything waiting for you, like transfers to send or items running low.", {
      spotlight: "dash-attention",
    }),
    say("Shop 1 has only just opened. Let's head over to the till.", { spotlight: "nav" }),
  ]),

  scene("switch", "Switch cashier", [
    signInAs("kemi"),
    goto("/app/pos"),
    click("pos-shop", { match: "Shop 1" }),
    waitFor("till-header"),
    say("Several people share this till. Each sale should be recorded under whoever makes it.", {
      spotlight: "till-header",
    }),
    say("So nobody shares a login. A tap on Switch cashier hands the till over.", { spotlight: "switch-cashier" }),
    click("switch-cashier"),
    waitFor("lock-people"),
    say("Everyone who can use this till is listed. Ada is on shift, so she taps her name.", {
      spotlight: "lock-people",
    }),
    click("lock-people", { match: "Ada Nwosu" }),
    waitFor("pin-pad"),
    say("Then her own four-digit PIN. It takes about three seconds."),
    click("pin-pad", { match: "2" }),
    click("pin-pad", { match: "5" }),
    click("pin-pad", { match: "8" }),
    click("pin-pad", { match: "0" }),
    waitFor("till-header"),
    say("Ada is in. A PIN only opens the till, and it locks itself after two minutes of quiet.", {
      spotlight: "whoami",
    }),
  ]),

  scene("sale", "Making a sale", [
    signInAs("ada"),
    goto("/app/pos"),
    waitFor("sku-search"),
    say("A customer wants a shaggy rug and a set of dishes. Ada scans them, or types a few letters.", {
      spotlight: "sku-search",
    }),
    type("sku-search", "shaggy", { clear: true }),
    waitFor("sku-results", { match: "CRUG-005" }),
    click("sku-results", { match: "CRUG-005" }),
    type("sku-search", "dishes", { clear: true }),
    waitFor("sku-results", { match: "T3-14G" }),
    click("sku-results", { match: "T3-14G" }),
    say("The price and the photo come from the catalogue, so there's no guessing at the counter.", {
      spotlight: "cart",
    }),
    type("customer-phone", "0812 345 6789"),
    type("customer-name", "Tolu Bakare"),
    say("She's a regular, so Ada gives five percent off. The owner sets a limit for each person.", {
      spotlight: "checkout",
    }),
    click("add-discount"),
    type("discount-value", "5"),
    type("discount-reason", "Regular customer"),
    say("A reason is required, and every discount shows up in the staff report.", { spotlight: "discount" }),
    click("charge"),
    waitFor("pay-amount-0"),
    say("Tolu pays part in cash and the rest by bank transfer."),
    type("pay-amount-0", "50000", { clear: true }),
    click("split-payment"),
    waitFor("pay-ref-1"),
    type("pay-ref-1", "Tolu Bakare"),
    say("The two payments must add up to the total exactly, so the till always balances.", {
      spotlight: "checkout",
    }),
    click("complete-sale"),
    waitFor("sale-complete"),
    say("Done. The stock has already come off Shop 1, and the receipt can be printed or sent on WhatsApp.", {
      spotlight: "sale-complete",
    }),
  ]),

  scene("exchange", "An exchange", [
    signInAs("ada"),
    goto("/app/sales"),
    waitFor("sale-search"),
    say("Yesterday Amaka bought a rug. It's too small, and she's back to change it.", {
      spotlight: "sale-search",
    }),
    type("sale-search", "08035550142", { clear: true }),
    press("sale-search"),
    waitFor("sales-list", { match: "Amaka Obi" }),
    say("Her phone number finds the sale, no paper receipt needed.", { spotlight: "sales-list" }),
    click("sales-list", { match: "Amaka Obi" }),
    waitFor("exchange-items"),
    click("exchange-items"),
    waitFor("return-qty-0"),
    type("return-qty-0", "1", { clear: true }),
    type("return-reason", "Too small for her living room"),
    say("Modasa doesn't give cash refunds. The rug becomes credit towards something of equal or higher value.", {
      spotlight: "return-credit",
    }),
    click("continue-to-till"),
    waitFor("exchange-banner"),
    say("Back at the till, the credit is waiting.", { spotlight: "exchange-banner" }),
    type("sku-search", "turkey", { clear: true }),
    waitFor("sku-results", { match: "CRUG-003" }),
    click("sku-results", { match: "CRUG-003" }),
    say("She picks the bigger five by seven, on offer at a hundred and twenty thousand.", { spotlight: "cart" }),
    say("So she only tops up the difference.", { spotlight: "charge" }),
    click("charge"),
    waitFor("payment-0"),
    click("payment-0", { match: "Bank transfer" }),
    type("pay-ref-0", "Amaka Obi"),
    click("complete-sale"),
    waitFor("sale-complete"),
    say("Exchanged. The small rug is back in stock and the books balance to the naira.", {
      spotlight: "sale-complete",
    }),
  ]),

  scene("stock", "Stock and transfers", [
    signInAs("kemi"),
    goto("/app/stock"),
    waitFor("stock-values"),
    say("Back in the office, Kemi can see the stock in every shop and warehouse, valued at cost.", {
      spotlight: "stock-values",
    }),
    type("stock-search", "laundry", { clear: true }),
    press("stock-search"),
    waitFor("stock-table", { match: "Laundry Basket" }),
    say("Shop 1 is down to its last laundry basket. Red means it's below the reorder level.", {
      spotlight: "stock-table",
      match: "Laundry Basket",
    }),
    say("Warehouse B has thirty, so she asks for five to be sent over."),
    goto("/app/transfers/new"),
    waitFor("transfer-from"),
    choose("transfer-from", "Warehouse B"),
    choose("transfer-to", "Shop 1"),
    type("sku-search", "laundry", { clear: true }),
    waitFor("sku-results", { match: "LX21-KC12S" }),
    click("sku-results", { match: "LX21-KC12S" }),
    type("transfer-qty-0", "5", { clear: true }),
    type("transfer-note", "Shop 1 is running low"),
    click("create-transfer"),
    wait(2500),
    say("The warehouse sees the request straight away. Shop 1 confirms what arrives, so nothing goes missing."),
  ]),

  scene("reports", "Reports", [
    signInAs("kemi"),
    goto("/app/reports"),
    waitFor("report-totals"),
    say("Reports turn all of this into answers. Net sales, number of sales and the average sale, for any dates.", {
      spotlight: "report-totals",
    }),
    click("tabs", { match: "Staff" }),
    waitFor("staff-report"),
    say("And who sold what. Ada's sale, her discount and today's exchange are already here.", {
      spotlight: "staff-report",
      match: "Ada Nwosu",
    }),
    say("Discounts, exchanges and cash differences, person by person. No surprises at the end of the month.", {
      spotlight: "staff-report",
    }),
  ]),

  scene("goodbye", "Goodbye", [
    signInAs("kemi"),
    goto("/app"),
    waitFor("dash-shops"),
    say("And back home, Shop 1's sales are already on the board.", { spotlight: "dash-shops" }),
    wave(),
    say("That's Modasa: selling, stock and reports in one place. Thanks for watching!"),
  ]),
];
