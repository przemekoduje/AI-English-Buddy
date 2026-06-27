import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import StoryGenerator from './StoryGenerator';

describe('StoryGenerator Popular Science Settings', () => {
  const mockSuggestedTopics = ['Science', 'Technology', 'Psychology'];
  const mockUser = { token: 'test-token' };
  const mockOnGenerate = jest.fn();

  beforeEach(() => {
    // Mock fetch for settings endpoint
    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          language_level: 'medium',
          length: 'medium',
          is_factual: false,
          protagonist: '',
          genre: 'adventure',
          focus_area: 'none',
          is_popular_science: false,
          scientific_bias: false,
          scientific_communication: false,
          scientific_language_link: false
        })
      })
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('toggling popular science style displays sub-checkboxes', async () => {
    await act(async () => {
      render(
        <StoryGenerator
          onGenerate={mockOnGenerate}
          isLoading={false}
          suggestedTopics={mockSuggestedTopics}
          user={mockUser}
        />
      );
    });

    // Expand settings
    const settingsButton = screen.getByText(/Story Style & Settings/i);
    fireEvent.click(settingsButton);

    // Main popular science checkbox should be in document
    const mainCheckbox = screen.getByLabelText(/Popular science style/i);
    expect(mainCheckbox).toBeInTheDocument();
    expect(mainCheckbox.checked).toBe(false);

    // Suboptions should not be visible initially
    expect(screen.queryByLabelText(/Explain cognitive biases & psychology/i)).not.toBeInTheDocument();

    // Check main popular science checkbox
    fireEvent.click(mainCheckbox);
    expect(mainCheckbox.checked).toBe(true);

    // Suboptions should now be visible
    const biasCheckbox = screen.getByLabelText(/Explain cognitive biases & psychology/i);
    const commCheckbox = screen.getByLabelText(/Focus on communication barriers & paradoxes/i);
    const langCheckbox = screen.getByLabelText(/Relate to language learning & agility/i);

    expect(biasCheckbox).toBeInTheDocument();
    expect(commCheckbox).toBeInTheDocument();
    expect(langCheckbox).toBeInTheDocument();

    // Verify sub-checkboxes default to true upon enabling main checkbox (convenience)
    expect(biasCheckbox.checked).toBe(true);
    expect(commCheckbox.checked).toBe(true);
    expect(langCheckbox.checked).toBe(true);

    // Verify sub-checkboxes can be individually toggled
    fireEvent.click(biasCheckbox);
    expect(biasCheckbox.checked).toBe(false);
  });
});
