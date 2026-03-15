import React, { useState } from "react";
import "./StoryGenerator.css";

const StoryGenerator = ({ onGenerate, isLoading, suggestedTopics }) => {
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [customDetails, setCustomDetails] = useState("");

  const handleTopicToggle = (topic) => {
    setSelectedTopics((prevSelected) =>
      prevSelected.includes(topic)
        ? prevSelected.filter((t) => t !== topic)
        : [...prevSelected, topic]
    );
  };

  const handleGenerateStory = () => {
    if (selectedTopics.length === 0) {
      alert("Proszę wybrać co najmniej jeden temat.");
      return;
    }
    const combinedTopics = selectedTopics.join(", ");
    let fullPrompt = `Write a creative story (about 300 words) that combines the following topics: ${combinedTopics}.`;
    if (customDetails.trim() !== "") {
      fullPrompt += ` Additionally, please incorporate these details: "${customDetails}"`;
    }
    onGenerate(fullPrompt);
  };

  return (
    <div className="story-generator">
      <div className="generator-header">
        <h2>Generate Your Story</h2>
        <p>Choose topics and add details to create a unique learning experience.</p>
      </div>

      <div className="topic-grid">
        {suggestedTopics.map((topic) => (
          <button
            key={topic}
            onClick={() => handleTopicToggle(topic)}
            className={`topic-chip ${selectedTopics.includes(topic) ? "selected" : ""}`}
            disabled={isLoading}
          >
            {topic}
          </button>
        ))}
      </div>

      <div className="details-composer">
        <textarea
          value={customDetails}
          onChange={(e) => setCustomDetails(e.target.value)}
          placeholder="Describe any specific events, characters, or context you'd like to include..."
          rows="4"
          disabled={isLoading}
        />
      </div>

      <button
        onClick={handleGenerateStory}
        disabled={isLoading || selectedTopics.length === 0}
        className="generate-story-btn"
      >
        {isLoading ? (
          <span className="loader-inner">Developing Story...</span>
        ) : (
          <>
            <span>Craft My Story</span>
            <span className="btn-icon">✨</span>
          </>
        )}
      </button>
    </div>
  );
};

export default StoryGenerator;
