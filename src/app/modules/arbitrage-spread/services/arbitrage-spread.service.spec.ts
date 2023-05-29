import { fakeAsync, TestBed, tick } from '@angular/core/testing';

import { ArbitrageSpreadService } from './arbitrage-spread.service';
import { LocalStorageService } from "../../../shared/services/local-storage.service";
import { QuotesService } from "../../../shared/services/quotes.service";
import { of, filter, take, skip } from "rxjs";
import { OrderService } from "../../../shared/services/orders/order.service";
import { PositionsService } from "../../../shared/services/positions.service";
import { AuthService } from "../../../shared/services/auth.service";
import { Side } from "../../../shared/models/enums/side.model";

const spreadItem = {
  id: 'spreadId',
  firstLeg: {
    instrument: {symbol: 'symbol1', exchange: 'exchange1', shortName: '', description: '', minstep: 1, currency: ''},
    quantity: 1,
    ratio: 1,
    portfolio: {portfolio: 'portfolio1', exchange: 'exchange1'},
  },
  secondLeg: {
    instrument: {symbol: 'symbol2', exchange: 'exchange2', shortName: '', description: '', minstep: 2, currency: ''},
    quantity: 2,
    ratio: 2,
    portfolio: {portfolio: 'portfolio2', exchange: 'exchange2'},
  }
};

const quote = {
  ask: 2,
  bid: 3
};

describe('ArbitrageSpreadService', () => {
  let service: ArbitrageSpreadService;
  let localStorageSpy = jasmine.createSpyObj('localStorageSpy', ['getItem', 'setItem']);
  let orderServiceSpy = jasmine.createSpyObj('orderServiceSpy', ['submitMarketOrder']);
  let quotesServiceSpy = jasmine.createSpyObj('quotesServiceSpy', ['getQuotes']);
  let positionsServiceSpy = jasmine.createSpyObj('positionsServiceSpy', ['getAllByLogin']);

  beforeEach(() => {
    localStorageSpy.getItem = jasmine.createSpy('getItem').and.returnValue([]);
    localStorageSpy.setItem = jasmine.createSpy('setItem').and.callThrough();

    TestBed.configureTestingModule({
      providers: [
        {
          provide: LocalStorageService,
          useValue: localStorageSpy
        },
        {
          provide: QuotesService,
          useValue: quotesServiceSpy
        },
        {
          provide: OrderService,
          useValue: orderServiceSpy
        },
        {
          provide: PositionsService,
          useValue: positionsServiceSpy
        },
        {
          provide: AuthService,
          useValue: {
            currentUser$: of({ login: 'testLogin' })
          }
        }
      ]
    });
    service = TestBed.inject(ArbitrageSpreadService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should get spreads subscription', fakeAsync(() => {
    const expectedQuantity = 5;

    localStorageSpy.getItem = jasmine.createSpy('getItem').and.returnValue([spreadItem]);
    quotesServiceSpy.getQuotes = jasmine.createSpy('getQuotes').and.returnValue(of(quote));
    positionsServiceSpy.getAllByLogin = jasmine.createSpy('getAllByLogin').and.returnValue(of([
      {
        exchange: spreadItem.firstLeg.portfolio.exchange,
        portfolio: spreadItem.firstLeg.portfolio.portfolio,
        symbol: spreadItem.firstLeg.instrument.symbol,
        qtyTFutureBatch: expectedQuantity
      }
    ]));

    service.getSpreadsSubscription()
      .pipe(
        take(1)
      )
      .subscribe(spreads => {
        const spread = spreads[0];

        expect(spread.buySpread).toBe(quote.ask * spread.firstLeg.quantity * spread.firstLeg.quantity -
          quote.bid * spread.secondLeg.quantity * spread.secondLeg.quantity);
        expect(spread.sellSpread).toBe(quote.bid * spread.firstLeg.quantity * spread.firstLeg.quantity -
          quote.ask * spread.secondLeg.quantity * spread.secondLeg.quantity);
        expect(spread.firstLeg.positionsCount).toBe(expectedQuantity);
        expect(spread.secondLeg.positionsCount).toBe(0);
      });

    tick();

    expect(quotesServiceSpy.getQuotes).toHaveBeenCalledWith(
      spreadItem.firstLeg.instrument.symbol,
      spreadItem.firstLeg.instrument.exchange,
      undefined
    );

    expect(quotesServiceSpy.getQuotes).toHaveBeenCalledWith(
      spreadItem.secondLeg.instrument.symbol,
      spreadItem.secondLeg.instrument.exchange,
      undefined
    );
  }));

  it('should add new spread', fakeAsync(() => {
    service.getSpreadsSubscription()
      .pipe(
        filter(spreads => !!spreads.length),
        take(1)
      )
      .subscribe(spreads => {
        expect(spreads[0].firstLeg.instrument).toEqual(spreadItem.firstLeg.instrument);
        expect(spreads[0].firstLeg.portfolio).toEqual(spreadItem.firstLeg.portfolio);
        expect(spreads[0].firstLeg.quantity).toBe(spreadItem.firstLeg.quantity);
        expect(spreads[0].firstLeg.ratio).toBe(spreadItem.firstLeg.ratio);

        expect(spreads[0].secondLeg.instrument).toEqual(spreadItem.secondLeg.instrument);
        expect(spreads[0].secondLeg.portfolio).toEqual(spreadItem.secondLeg.portfolio);
        expect(spreads[0].secondLeg.quantity).toBe(spreadItem.secondLeg.quantity);
        expect(spreads[0].secondLeg.ratio).toBe(spreadItem.secondLeg.ratio);
      });

    service.addSpread(spreadItem);

    tick();
  }));

  it('should edit spread', fakeAsync(() => {
    localStorageSpy.getItem = jasmine.createSpy('getItem').and.returnValue([spreadItem]);

    const expectedSpread = {
      firstLeg: {
        instrument: { symbol: 'symbol11', exchange: 'exchange11', shortName: '', description: '', minstep: 11, currency: '' },
        quantity: 1,
        ratio: 1,
        portfolio: { portfolio: 'portfolio1', exchange: 'exchange1' },
      },
      secondLeg: {
        instrument: { symbol: 'symbol22', exchange: 'exchange22', shortName: '', description: '', minstep: 22, currency: '' },
        quantity: 22,
        ratio: 22,
        portfolio: { portfolio: 'portfolio22', exchange: 'exchange22' },
      }
    };

    service.getSpreadsSubscription()
      .pipe(
        filter(spreads => !!spreads.length),
        skip(1),
        take(1)
      )
      .subscribe(spreads => {
        expect(spreads[0].id).toBe(spreadItem.id);

        expect(spreads[0].firstLeg.instrument).toEqual(expectedSpread.firstLeg.instrument);
        expect(spreads[0].firstLeg.portfolio).toEqual(expectedSpread.firstLeg.portfolio);
        expect(spreads[0].firstLeg.quantity).toBe(expectedSpread.firstLeg.quantity);
        expect(spreads[0].firstLeg.ratio).toBe(expectedSpread.firstLeg.ratio);

        expect(spreads[0].secondLeg.instrument).toEqual(expectedSpread.secondLeg.instrument);
        expect(spreads[0].secondLeg.portfolio).toEqual(expectedSpread.secondLeg.portfolio);
        expect(spreads[0].secondLeg.quantity).toBe(expectedSpread.secondLeg.quantity);
        expect(spreads[0].secondLeg.ratio).toBe(expectedSpread.secondLeg.ratio);
      });

    service.editSpread({
      ...expectedSpread,
      id: spreadItem.id
    });
    tick();
  }));

  it('should remove spread', fakeAsync(() => {
    localStorageSpy.getItem = jasmine.createSpy('getItem').and.returnValue([spreadItem]);

    service.getSpreadsSubscription()
      .pipe(
        skip(1),
        take(1)
      )
      .subscribe(spreads => {
        expect(spreads.length).toBe(0);
      });

    service.removeSpread(spreadItem.id);
    tick();
  }));

  it('should save spreads', fakeAsync(() => {
    service.getSpreadsSubscription().subscribe();

    service.addSpread(spreadItem);
    service.editSpread(spreadItem);
    service.removeSpread(spreadItem.id);

    tick();

    expect(localStorageSpy.setItem).toHaveBeenCalledTimes(4);
  }));

  it('should buy spread', fakeAsync(() => {
    orderServiceSpy.submitMarketOrder = jasmine.createSpy('submitMarketOrder').and.returnValue(of({}));

    service.buySpread(spreadItem).subscribe();
    tick();

    expect(orderServiceSpy.submitMarketOrder).toHaveBeenCalledWith({
        instrument: spreadItem.firstLeg.instrument,
        side: Side.Buy,
        quantity: spreadItem.firstLeg.quantity
      },
      spreadItem.firstLeg.portfolio.portfolio
    );

    expect(orderServiceSpy.submitMarketOrder).toHaveBeenCalledWith({
        instrument: spreadItem.secondLeg.instrument,
        side: Side.Sell,
        quantity: spreadItem.secondLeg.quantity
      },
      spreadItem.secondLeg.portfolio.portfolio
    );
  }));

  it('should open spread modal', () => {
    service.shouldShowSpreadModal$
      .pipe(
        skip(1),
        take(1)
      )
      .subscribe(val => {
        expect(val).toBeTrue();
      });
    service.spreadParams$
      .pipe(
        skip(1),
        take(1)
      )
      .subscribe(spread => {
        expect(spread).toEqual(spreadItem);
      });

    service.openSpreadModal(spreadItem);
  });

  it('should close spread modal', () => {
    service.shouldShowSpreadModal$
      .pipe(
        skip(1),
        take(1)
      )
      .subscribe(val => {
        expect(val).toBeFalse();
      });
    service.spreadParams$
      .pipe(
        skip(1),
        take(1)
      )
      .subscribe(spread => {
        expect(spread).toBeNull();
      });

    service.closeSpreadModal();
  });
});