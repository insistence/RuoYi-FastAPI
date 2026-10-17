import { getRandomBytesAsync } from 'expo-crypto'
export const nativeRandomBytes = (length) => getRandomBytesAsync(length)
