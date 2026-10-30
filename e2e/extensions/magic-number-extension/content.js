const p = document.createElement("p");
p.id = "magic-number";
p.dataset.privateBrowsing = String(
  globalThis.browser?.extension?.inIncognitoContext,
);
p.innerText = "42";
document.body.append(p);
