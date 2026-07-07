module.exports = {
  preset: 'jest-expo',
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  // jest-expo's preset does not automatically mock @react-native-async-storage/async-storage,
  // so this explicitly wires up the package's official jest mock.
  moduleNameMapper: {
    '^@react-native-async-storage/async-storage$':
      '@react-native-async-storage/async-storage/jest/async-storage-mock',
  },
};
