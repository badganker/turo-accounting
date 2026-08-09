// Shared between the in-browser connect flow (browserSessions.js) and the
// local CLI script's flow (interactiveLogin.js) so the "is this person
// actually logged in yet" check can't drift out of sync between the two.

export const TURO_LOGIN_URL = "https://turo.com/us/en/login";

export async function isLoggedIntoTuro(page) {
  return page
    .evaluate(() => {
      const text = document.body.innerText || "";
      return text.includes("Switch to host") || text.includes("Switch to guest");
    })
    .catch(() => false);
}
