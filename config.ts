// src/config/config.ts

export const apiConfig = {
    baseURL: 'https://api.binance.us/api/v3/',
    timeout: 5000,
};

export const strategies = [
    'keltnerChannel',
    'movingAverageCrossover',
    'rsiOverboughtOversold'
];

export const defaultParams = {
    candleSize: 60,
    historySize: 10,
    feeMaker: 0.15,
    feeTaker: 0.15,
    slippage: 0.05,
};

export const dateFormat = 'YYYY-MM-DDTHH:mm:ssZ';
 
