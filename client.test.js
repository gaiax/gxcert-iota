const expect = require("expect");
const CertClient = require("./client");

test("get first address by cert client", async() => {
  const clientA = new CertClient("https://nodes.devnet.iota.org", "userA");
  const clientB = new CertClient("https://nodes.devnet.iota.org", "userB");
  await clientA.init();
  await clientB.init();
  const addressA = await clientA.getFirstAddress();
  const addressB = await clientB.getFirstAddress();
  const addressA2 = await clientA.getFirstAddress();
  expect(addressA).toEqual(addressA2);
  expect(addressA).not.toEqual(addressB);
});
