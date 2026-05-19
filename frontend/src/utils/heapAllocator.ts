const toHexAddress = (value: number) => `0x${value.toString(16).padStart(3, "0")}`;

export const createHeapAllocator = () => {
  const addresses = new Map<string, string>();
  let nextAddress = 1;

  const ensureAddress = (identity: string, explicitAddress?: string) => {
    if (explicitAddress) {
      const normalized = explicitAddress.toLowerCase();
      addresses.set(identity, normalized);
      return normalized;
    }

    const existing = addresses.get(identity);
    if (existing) {
      return existing;
    }

    const address = toHexAddress(nextAddress);
    nextAddress += 1;
    addresses.set(identity, address);
    return address;
  };

  return {
    ensureAddress,
    snapshot: () => new Map(addresses),
  };
};
