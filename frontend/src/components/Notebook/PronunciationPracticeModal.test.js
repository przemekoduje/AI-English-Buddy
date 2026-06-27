import React from "react";
import { API_BASE_URL } from '../../config';
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import PronunciationPracticeModal from "./PronunciationPracticeModal";

// Mock global audio
class MockAudio {
  constructor(url) {
    this.url = url;
    this.play = jest.fn().mockResolvedValue(true);
    this.pause = jest.fn();
  }
}
global.Audio = MockAudio;

// Mock MediaRecorder
class MockMediaRecorder {
  constructor(stream) {
    this.stream = stream;
    this.ondataavailable = null;
    this.onstop = null;
  }
  start() {
    // Simulate data available
    if (this.ondataavailable) {
      this.ondataavailable({ data: new Blob(["audio-data"], { type: "audio/webm" }) });
    }
  }
  stop() {
    if (this.onstop) this.onstop();
  }
}
global.MediaRecorder = MockMediaRecorder;

// Mock MediaDevices
const mockStream = {
  getTracks: () => [{ stop: jest.fn() }]
};
global.navigator.mediaDevices = {
  getUserMedia: jest.fn().mockResolvedValue(mockStream)
};

describe("PronunciationPracticeModal", () => {
  const mockTargetText = "Curse of Knowledge is real.";
  const mockUser = { token: "user-token" };
  const mockOnClose = jest.fn();
  const mockOnLogActivity = jest.fn();
  const mockOnLogPronunciationError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    global.alert = jest.fn();
  });

  test("renders target text and main buttons", () => {
    render(
      <PronunciationPracticeModal
        targetText={mockTargetText}
        user={mockUser}
        onClose={mockOnClose}
        onLogActivity={mockOnLogActivity}
        onLogPronunciationError={mockOnLogPronunciationError}
      />
    );

    expect(screen.getByText(/Zdanie do przeczytania/i)).toBeInTheDocument();
    expect(screen.getByText(`"${mockTargetText}"`)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Odsłuchaj wzór/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nagraj swój głos/i })).toBeInTheDocument();
  });

  test("clicking play pronunciation instantiates Audio", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ audio_base64: "dGVzdC1hdWRpby1iYXNlNjQ=" })
    });

    render(
      <PronunciationPracticeModal
        targetText={mockTargetText}
        user={mockUser}
        onClose={mockOnClose}
        onLogActivity={mockOnLogActivity}
        onLogPronunciationError={mockOnLogPronunciationError}
      />
    );

    const playButton = screen.getByRole("button", { name: /Odsłuchaj wzór/i });
    
    await act(async () => {
      fireEvent.click(playButton);
    });

    // Verify it changed to stopping label
    expect(screen.getByText(/Zatrzymaj/i)).toBeInTheDocument();
  });

  test("records audio, calls evaluate API and logs activity & pronunciation errors", async () => {
    const mockEvalResult = {
      score: 75,
      transcription: "curse of knowledge is real",
      corrections: "Zwróć uwagę na słowa: curse, real",
      tip: "Tempo dobre, lecz popracuj nad akcentem.",
      mispronounced_words: ["curse", "real"]
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockEvalResult)
    });

    render(
      <PronunciationPracticeModal
        targetText={mockTargetText}
        user={mockUser}
        onClose={mockOnClose}
        onLogActivity={mockOnLogActivity}
        onLogPronunciationError={mockOnLogPronunciationError}
      />
    );

    const recordButton = screen.getByRole("button", { name: /Nagraj swój głos/i });
    
    // Start recording
    await act(async () => {
      fireEvent.click(recordButton);
    });

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(screen.getByText(/Zatrzymaj \(/i)).toBeInTheDocument();

    // Stop recording and trigger evaluation
    await act(async () => {
      const stopButton = screen.getByText(/Zatrzymaj \(/i);
      fireEvent.click(stopButton);
    });

    // Check fetch evaluate is invoked
    expect(global.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/api/mastery-evaluate`,
      expect.any(Object)
    );

    // Verify results are rendered
    expect(await screen.findByText("75%")).toBeInTheDocument();
    expect(screen.getByText("Tempo dobre, lecz popracuj nad akcentem.")).toBeInTheDocument();
    expect(screen.getByText('"curse of knowledge is real"')).toBeInTheDocument();
    expect(screen.getByText("Zwróć uwagę na słowa: curse, real")).toBeInTheDocument();
    expect(screen.getByText("⚠️ curse")).toBeInTheDocument();
    expect(screen.getByText("⚠️ real")).toBeInTheDocument();

    // Verify callbacks are triggered
    expect(mockOnLogActivity).toHaveBeenCalledWith({
      type: "practice",
      word_or_phrase: mockTargetText,
      timestamp: expect.any(Number),
      details: {
        practice_score: 75,
        practice_sentence: mockTargetText,
        practice_transcription: "curse of knowledge is real"
      }
    });

    expect(mockOnLogPronunciationError).toHaveBeenCalledTimes(2);
    expect(mockOnLogPronunciationError).toHaveBeenNthCalledWith(1, "curse", mockTargetText);
    expect(mockOnLogPronunciationError).toHaveBeenNthCalledWith(2, "real", mockTargetText);
  });
});
