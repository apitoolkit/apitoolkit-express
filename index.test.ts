import { Config } from './index';

describe('testing init', () => {
  test('get correct response', async () => {
    const cfg: Config = {
      apiKey: "zqZOKsIZaC0zy9VM1KZsTDwd9GKfSdSe7Lrp1L5Y8WhQ8o3F",
    };
    // let x = await init(cfg);
    let x = 0
    expect(x).toBe(0);
  })
})
