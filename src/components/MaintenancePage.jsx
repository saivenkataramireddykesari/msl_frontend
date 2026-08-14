import React from 'react';
import './MaintenancePage.css'; // Will create this next

const MaintenancePage = () => {
  return (
    <div className="maintenance-container">
      <div className="maintenance-content">
        <img
          src="/maintenance-image.png" // Placeholder SVG
          alt="Under Maintenance"
          className="maintenance-illustration"
        />
        <h1 className="maintenance-heading">We'll Be Back Soon</h1>
        <p className="maintenance-subheading">
          Our application is currently undergoing scheduled maintenance.
        </p>
        <p className="maintenance-text">
          We're making improvements to provide you with a better experience. Please check back
          shortly.
        </p>
        <div className="maintenance-indicator">
          <div className="spinner"></div>
          <p>Maintenance in progress</p>
        </div>
        <p className="company-name">Your Company/Application Name</p>
      </div>
    </div>
  );
};

export default MaintenancePage;
