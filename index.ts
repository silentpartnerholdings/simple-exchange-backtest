import axios from 'axios';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { apiConfig, strategies, defaultParams } from './config/config';
import { signals } from './config/signals';

// Load environment variables from .env
dotenv.config();

const apiKey = process.env.BINANCE_API_KEY;

export type Candle = {
    openTime: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    closeTime: number;
};

// Function to fetch historical data from Binance.US
async function fetchHistoricalData(symbol: string, interval: string, startTime: number, endTime: number): Promise<Candle[]> {
    try {
        console.log(`Fetching data for symbol: ${symbol}, interval: ${interval}, startTime: ${new Date(startTime).toISOString()}, endTime: ${new Date(endTime).toISOString()}`);

        const response = await axios.get(`${apiConfig.baseURL}klines`, {
            params: {
                symbol,
                interval,
                startTime,
                endTime,
                limit: 1000,
            },
            headers: {
                'X-MBX-APIKEY': apiKey,
            },
        });

        if (response.data.length === 0) {
            console.warn('No data returned from Binance.');
        }

        return response.data.map((candle: any, index: number): Candle => {
            if (!candle || candle.length < 6) {
                console.warn(`Candle data missing or incomplete at index ${index}:`, candle);
                return {
                    openTime: 0,
                    open: 0,
                    high: 0,
                    low: 0,
                    close: 0,
                    volume: 0,
                    closeTime: 0,
                };
            }

            return {
                openTime: candle[0],
                open: parseFloat(candle[1]),
                high: parseFloat(candle[2]),
                low: parseFloat(candle[3]),
                close: parseFloat(candle[4]),
                volume: parseFloat(candle[5]),
                closeTime: candle[6],
            };
        });
    } catch (error) {
        console.error('Error fetching historical data:', error);
        throw error;
    }
}

// Function to run the backtest
async function runBacktest(asset: string, currency: string, startDate: string, startTime: string, endDate: string, endTime: string) {
    try {
        const symbol = `${asset}${currency}`;
        const interval = '1h'; // Example interval

        // Convert start and end dates with times to UTC timestamps
        const startTimeUTC = convertToUTCTimestamp(startDate, startTime);
        const endTimeUTC = convertToUTCTimestamp(endDate, endTime);

        // Fetch historical data from Binance.US
        const historicalData = await fetchHistoricalData(symbol, interval, startTimeUTC, endTimeUTC);

        // Check if historicalData is undefined or empty
        if (!historicalData || historicalData.length === 0) {
            console.error('Historical data is undefined or empty.');
            return;
        }

        // Print the length of the historical data for verification
        console.log(`Length of historical data: ${historicalData.length}`);

        let balance = 1000; // Starting balance
        let position = 0;   // Current position: 0 means no position, 1 means holding the asset
        let trades = 0;
        const initialPrice = historicalData[0].close;
        const finalPrice = historicalData[historicalData.length - 1].close;

        historicalData.forEach((candle: Candle | undefined, index: number) => {
            if (!candle || candle.close === undefined) {
                console.error(`Problematic candle at index ${index}:`, candle);
                return;  // Skip this iteration if candle is undefined or invalid
            }

            const previousCandles = historicalData.slice(0, index + 1);

            // Calculate the Keltner Channel
            try {
                const keltner = signals.keltnerChannel(previousCandles, {
                    atrMultiplierMin: 1.5,
                    atrMultiplierMax: 3.5,
                    atrLength: 88,
                    movingAverageLength: 34,
                    movingAverageType: "EMA"
                });

                // Buy/Sell logic based on Keltner Channel
                if (candle.close < keltner.bottomMin && position === 0) {
                    position = balance / candle.close; // Buy with all balance
                    balance = 0;
                    trades++;
                    console.log(`Buy at ${candle.close} on ${new Date(candle.closeTime).toISOString()} (Signal: Keltner Channel below bottomMin)`);
                } else if (candle.close > keltner.topMax && position > 0) {
                    balance = position * candle.close; // Sell everything
                    position = 0;
                    trades++;
                    console.log(`Sell at ${candle.close} on ${new Date(candle.closeTime).toISOString()} (Signal: Keltner Channel above topMax)`);
                }
            } catch (error) {
                console.error(`Error processing Keltner Channel at index ${index}:`, error);
            }
        });

        // Safeguard final access to the last candle
        if (historicalData.length > 0 && historicalData[historicalData.length - 1]) {
            const finalBalance = balance + (position * historicalData[historicalData.length - 1].close);
            const profit = finalBalance - 1000;

            // Calculate Buy and Hold Profit
            const buyAndHoldProfit = ((finalPrice - initialPrice) / initialPrice) * 1000;

            console.log(`Final Balance: ${finalBalance}`);
            console.log(`Profit: ${profit}`);
            console.log(`Buy and Hold Profit: ${buyAndHoldProfit}`);
            console.log(`Initial Price: ${initialPrice} on ${new Date(historicalData[0].closeTime).toISOString()}`);
            console.log(`Final Price: ${finalPrice} on ${new Date(historicalData[historicalData.length - 1].closeTime).toISOString()}`);
            console.log(`Total Trades: ${trades}`);
        } else {
            console.error('Error accessing final candle for calculating final balance.');
        }

    } catch (error) {
        console.error('Error running backtest:', error);
    }
}

// Helper function to convert date and time in UTC to timestamp in milliseconds
function convertToUTCTimestamp(date: string, time: string): number {
    const [year, month, day] = date.split('-').map(Number);
    const [hours, minutes] = time.split(':').map(Number);

    // Create a Date object in UTC
    const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes));

    // Convert to milliseconds since Unix epoch
    return utcDate.getTime();
}

// Example usage with specific date range and time in UTC
runBacktest('BTC', 'USDC', '2023-08-01', '00:00', '2024-08-02', '00:00');
