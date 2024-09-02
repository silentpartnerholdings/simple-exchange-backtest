import { Candle } from '../types'; // Import the Candle type from a central location if necessary

export const signals = {
    movingAverageCrossover: (candles: Candle[]) => {
        const shortMA = candles.slice(-5).reduce((acc, candle) => acc + candle.close, 0) / 5;
        const longMA = candles.slice(-20).reduce((acc, candle) => acc + candle.close, 0) / 20;

        if (shortMA > longMA) {
            return 'buy';
        } else if (shortMA < longMA) {
            return 'sell';
        } else {
            return 'hold';
        }
    },

    rsiOverboughtOversold: (candles: Candle[]) => {
        const gains: number[] = [];
        const losses: number[] = [];

        for (let i = 1; i < candles.length; i++) {
            const difference = candles[i].close - candles[i - 1].close;
            if (difference > 0) {
                gains.push(difference);
            } else {
                losses.push(Math.abs(difference));
            }
        }

        const avgGain = gains.reduce((acc, gain) => acc + gain, 0) / gains.length;
        const avgLoss = losses.reduce((acc, loss) => acc + loss, 0) / losses.length;

        const rs = avgGain / avgLoss;
        const rsi = 100 - (100 / (1 + rs));

        if (rsi > 70) {
            return 'sell';
        } else if (rsi < 30) {
            return 'buy';
        } else {
            return 'hold';
        }
    },

    keltnerChannel: (candles: Candle[], options: { atrMultiplierMin: number; atrMultiplierMax: number; atrLength: number; movingAverageLength: number; movingAverageType: string }) => {
        const { atrMultiplierMin, atrMultiplierMax, atrLength, movingAverageLength, movingAverageType } = options;

        const movingAverage = (type: string, src: number[], len: number): number => {
            if (type === "EMA") {
                return ema(src, len);
            }
            return sma(src, len);
        };

        const ema = (src: number[], len: number): number => {
            const alpha = 2 / (len + 1);
            return src.reduce((prev, curr, idx) => {
                if (idx === 0) return curr;
                return alpha * curr + (1 - alpha) * prev;
            });
        };

        const sma = (src: number[], len: number): number => {
            return src.slice(-len).reduce((sum, val) => sum + val, 0) / len;
        };

        const trueRange = candles.map((candle, i) => {
            if (i === 0) return candle.high - candle.low;
            return Math.max(
                candle.high - candle.low,
                Math.abs(candle.high - candles[i - 1].close),
                Math.abs(candle.low - candles[i - 1].close)
            );
        });

        const atr = sma(trueRange, atrLength);

        const mid = movingAverage(movingAverageType, candles.map((c: Candle) => c.close), movingAverageLength);
        const topMin = mid + atr * atrMultiplierMin;
        const topMax = mid + atr * atrMultiplierMax;
        const bottomMin = mid - atr * atrMultiplierMin;
        const bottomMax = mid - atr * atrMultiplierMax;

        return {
            mid,
            topMin,
            topMax,
            bottomMin,
            bottomMax
        };
    }
};
