// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// React Router 7 uses the Web Encoding API, absent from Jest's jsdom.
import { TextEncoder, TextDecoder } from 'util';
Object.assign(globalThis, { TextEncoder, TextDecoder });
