import React from 'react';
import styles from '../styles/ErrorMessage.module.css';

const ErrorMessage = ({ message }) => {
  return (
    <div className={styles.errorContainer}>
      <div className={styles.errorMessage}>
        <h3>エラーが発生しました</h3>
        <p>{message}</p>
      </div>
    </div>
  );
};

export default ErrorMessage; 