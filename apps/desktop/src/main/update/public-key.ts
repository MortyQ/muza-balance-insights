// Public half of the update signing key (scripts/update-keygen.mjs). An update is installed only if its manifest
// verifies against this key. Changing it = every installed copy refuses updates until reinstalled by hand.
export const UPDATE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEANVLmRSsh3G/ogNQ9GZbPEoZ9a+dNKAbbuCaoe9bStKs=
-----END PUBLIC KEY-----
`;
