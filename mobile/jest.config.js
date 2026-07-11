module.exports = {
  preset: 'jest-expo',
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  // jest-expo's preset does not automatically mock @react-native-async-storage/async-storage,
  // so this explicitly wires up the package's official jest mock.
  moduleNameMapper: {
    '^@react-native-async-storage/async-storage$':
      '@react-native-async-storage/async-storage/jest/async-storage-mock',
    // expo-secure-store has no native module in Jest — see __mocks__/expo-secure-store.ts
    '^expo-secure-store$': '<rootDir>/__mocks__/expo-secure-store.ts',
  },
};
