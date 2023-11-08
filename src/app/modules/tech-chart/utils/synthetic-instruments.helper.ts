import {
  InstrumentDataPart,
  OperatorPart,
  RegularOrSyntheticInstrumentKey,
  SyntheticInstrumentPart
} from "../models/synthetic-instruments.model";
import { Candle } from "../../../shared/models/history/candle.model";
import { Instrument } from "../../../shared/models/instruments/instrument.model";
import { InstrumentKey } from "../../../shared/models/instruments/instrument-key.model";

const DEFAULT_EXCHANGE = 'MOEX';

export const SYNTHETIC_INSTRUMENT_REGEX = /[^\[]+(?=])|[\^+*\/()-]|[\w:.]+(?:-\d+\.\d+)?[\w:.]*/g;

export class SyntheticInstrumentsHelper {
  static getSyntheticInstrumentKeys(searchString: string): RegularOrSyntheticInstrumentKey {
    if (!searchString) {
      return { isSynthetic: false, instrument: { symbol: '', exchange: '' }};
    }

    const parts: SyntheticInstrumentPart[] = searchString
        .match(SYNTHETIC_INSTRUMENT_REGEX)
        ?.map(s => {
          if (s.match(/[a-zA-Z]/)) {
            if (s.includes(':')) {
              return {
                isSpreadOperator: false,
                value: this.getSymbolAndExchangeFromTicker(s)
              } as InstrumentDataPart;
            }
            return {
              isSpreadOperator: false,
              value: this.getSymbolAndExchangeFromTicker(DEFAULT_EXCHANGE + ':' + s)
            } as InstrumentDataPart;
          }

          if (s === '^') {
            return { isSpreadOperator: true, value: '**' } as OperatorPart;
          }
          return { isSpreadOperator: true, value: s } as OperatorPart;
        })
      ?? [];

    if (parts.length < 2) {
      if ((<InstrumentDataPart>parts[0])?.value.symbol) {
        return {
          isSynthetic: false,
          instrument: (<InstrumentDataPart>parts[0]).value,
        };
      }
      return { isSynthetic: false, instrument: { symbol: '', exchange: '' }};
    }

    return { isSynthetic: true, parts };
  }

  static getSymbolAndExchangeFromTicker(symbolName: string): InstrumentKey {
    const splits = symbolName.split(':');

    if (splits.length < 2) {
      return { symbol: splits[0], exchange: '' };
    }

    return { symbol: splits[1], exchange: splits[0], instrumentGroup: splits[2] };
  }

  static isSyntheticInstrument(symbolName: string): boolean {
    return this.getSyntheticInstrumentKeys(symbolName).isSynthetic;
  }

  static assembleInstrument(instruments: SyntheticInstrumentPart<Instrument>[]): Instrument {
    return instruments.reduce((acc, curr) => {
      if (curr.isSpreadOperator) {
        return {
          ...acc,
          symbol: acc.symbol + curr.value,
          description: acc.description + curr.value,
          exchange: acc.exchange + curr.value,
          type: acc.type + curr.value ?? '',
          shortName: acc.shortName + curr.value,
        } as Instrument;
      } else {
        return {
          symbol:
            acc.symbol +
            `[${curr.value!.exchange}:${curr.value!.symbol}${curr.value!.instrumentGroup ? ':' + curr.value!.instrumentGroup : ''}]`,
          description: acc.description + curr.value!.symbol,
          exchange: acc.exchange + curr.value!.exchange,
          currency: acc.currency || curr.value!.currency,
          type: acc.type + (curr.value!.type ?? ''),
          shortName: acc.shortName + `[${curr.value!.exchange}:${curr.value!.symbol}${curr.value!.instrumentGroup ? ':' + curr.value!.instrumentGroup : ''}]`,
          minstep: Math.min(acc.minstep, curr.value!.minstep),
        } as Instrument;
      }
    }, {
      symbol: '',
      description: '',
      exchange: '',
      currency: '',
      minstep: Infinity,
      type: '',
      shortName: ''
    } as Instrument);
  }

  static assembleCandle(candles: SyntheticInstrumentPart<Candle>[]): Candle {
    const candle = candles.reduce((acc, curr) => {
      if (curr.isSpreadOperator) {
          return {
            ...acc,
            close: acc.close + curr.value,
            open: acc.open + curr.value,
            high: acc.high + curr.value,
            low: acc.low + curr.value,
          };
      } else {
        return {
          close: acc.close + curr.value.close,
          open: acc.open + curr.value.open,
          high: acc.high + curr.value.high,
          low: acc.low + curr.value.low,
          time: Math.max(acc.time, curr.value.time),
        };
      }
    }, {
      close: '',
      open: '',
      high: '',
      low: '',
      time: 0
    });

    return {
      ...candle,
      close: eval(candle.close),
      open: eval(candle.open),
      high: eval(candle.high),
      low: eval(candle.low),
      volume: 0,
    } as Candle;
  }
}
