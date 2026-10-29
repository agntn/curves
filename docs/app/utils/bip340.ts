/** BIP340 test vector 1: the hex digits of pi as the message, signed by a key made of e's. */
export const PI_VECTOR = {
  publicKey: "dff1d77f2a671c5f36183726db2341be58feae1da2deced843240f7b502ba659",
  message: "243f6a8885a308d313198a2e03707344a4093822299f31d0082efa98ec4e6c89",
  signature:
    "6896bd60eeae296db48a229ff71dfe071bde413e6d43f917dc8dcf8c78de33418906d11ac976abccb20b091292bff4ea897efcb639ea871cfa95f6de339e4b0a",
} as const;

/** BIP340 test vector 15, a signature over no bytes at all. */
export const EMPTY_VECTOR = {
  publicKey: "778caa53b4393ac467774d09497a87224bf9fab6f6e68b23086497324d6fd117",
  message: "",
  signature:
    "71535db165ecd9fbbc046e5ffaea61186bb6ad436732fccc25291a55895464cf6069ce26bf03466228f19a3a62db8a649f2d560fac652827d1af0574e427ab63",
} as const;
