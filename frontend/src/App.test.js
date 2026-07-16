import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App';

test('renders Speakling title', () => {
  render(<App />);
  const titleElement = screen.getByText(/Speakling/i);
  expect(titleElement).toBeInTheDocument();
});
