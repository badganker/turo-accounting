// Lightweight authenticated requests against turo.com using a saved
// Playwright storageState, without spinning up a browser for every sync.

function cookieHeader(storageState) {
  return storageState.cookies
    .filter((c) => c.domain.includes("turo.com"))
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}

export async function turoGet(path, storageState) {
  const url = path.startsWith("http") ? path : `https://turo.com${path}`;
  const res = await fetch(url, {
    headers: {
      Cookie: cookieHeader(storageState),
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36",
      Accept: "text/csv,text/plain,*/*",
    },
    redirect: "manual",
  });

  // A redirect (to /login, etc.) means the saved session is no longer valid.
  if (res.status >= 300 && res.status < 400) {
    const err = new Error("Turo session expired (redirected to login).");
    err.code = "SESSION_EXPIRED";
    throw err;
  }
  if (!res.ok) {
    throw new Error(`Turo request failed: ${res.status} ${res.statusText}`);
  }
  return res.text();
}
