import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App';

test('renders AI English Buddy title', () => {
  render(<App />);
  const titleElement = screen.getByText(/AI English Buddy/i);
  expect(titleElement).toBeInTheDocument();
});
