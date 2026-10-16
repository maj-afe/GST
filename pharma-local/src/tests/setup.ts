/**
 * Test setup – imports jest-dom matchers and configures
 * the test environment for React component testing.
 */
import "@testing-library/jest-dom";

// Mock window.alert and window.confirm for components that use them
window.alert = vi.fn();
window.confirm = vi.fn(() => true);
