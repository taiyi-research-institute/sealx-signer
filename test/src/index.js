import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import TransferTest from './TransferTest';
import reportWebVitals from './reportWebVitals';

// 简单的路由：根据 URL 路径渲染不同组件
const path = window.location.pathname;
const RootComponent = path === '/transfer-test' ? TransferTest : App;

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <RootComponent />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
