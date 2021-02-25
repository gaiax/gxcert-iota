const expect = require("expect");
const { getSeed } = require("./seed");

it("seed generation", () => {
  const seed1 = getSeed("seed");
  const seed2 = getSeed("seed2");
  const seed3 = getSeed("seed");
  expect(seed1).toEqual(seed3);
  expect(seed1).not.toEqual(seed2);
});
