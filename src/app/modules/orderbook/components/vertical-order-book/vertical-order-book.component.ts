import {
  Component,
  Input,
  OnInit
} from '@angular/core';
import { WidgetSettingsService } from "../../../../shared/services/widget-settings.service";
import { OrderbookService } from "../../services/orderbook.service";
import {
  filter,
  Observable,
  shareReplay,
  tap
} from "rxjs";
import {
  CurrentOrder,
  VerticalOrderBook,
  VerticalOrderBookRowType,
  VerticalOrderBookRowView
} from "../../models/vertical-order-book.model";
import { VerticalOrderBookSettings } from "../../../../shared/models/settings/vertical-order-book-settings.model";
import {
  map,
  startWith
} from "rxjs/operators";
import {
  buyColorBackground,
  sellColorBackground
} from "../../../../shared/models/settings/styles-constants";
import { CancelCommand } from "../../../../shared/models/commands/cancel-command.model";
import { InstrumentsService } from "../../../instruments/services/instruments.service";
import { mapWith } from "../../../../shared/utils/observable-helper";
import { Instrument } from "../../../../shared/models/instruments/instrument.model";
import { getTypeByCfi } from "../../../../shared/utils/instruments";
import { InstrumentType } from "../../../../shared/models/enums/instrument-type.model";

@Component({
  selector: 'ats-vertical-order-book[guid][shouldShowSettings]',
  templateUrl: './vertical-order-book.component.html',
  styleUrls: ['./vertical-order-book.component.less']
})
export class VerticalOrderBookComponent implements OnInit {
  rowTypes = VerticalOrderBookRowType;
  maxVolume: number = 1;

  @Input() shouldShowSettings!: boolean;
  @Input() guid!: string;

  orderBookRows$!: Observable<VerticalOrderBookRowView[]>;

  constructor(
    private readonly settingsService: WidgetSettingsService,
    private readonly orderBookService: OrderbookService,
    private readonly instrumentsService: InstrumentsService) {
  }

  ngOnInit(): void {
    const settings$ = this.settingsService.getSettings<VerticalOrderBookSettings>(this.guid).pipe(shareReplay());
    const getInstrumentInfo = (settings: VerticalOrderBookSettings) => this.instrumentsService.getInstrument(settings).pipe(
      filter((x): x is Instrument => !!x)
    );

    this.orderBookRows$ = settings$.pipe(
      mapWith(
        settings => getInstrumentInfo(settings),
        (settings, instrument) => ({ settings, instrument })
      ),
      mapWith(
        ({ settings, instrument }) => this.orderBookService.getVerticalOrderBook(settings, instrument),
        ({ settings, instrument }, orderBook) => ({ settings, instrument, orderBook })
      ),
      map(x => this.toViewModel(x.settings, x.instrument, x.orderBook)),
      tap(orderBookRows => {
        this.maxVolume = Math.max(...orderBookRows.map(x => x.volume ?? 0));
      }),
      startWith([])
    );
  }

  getTrackKey(index: number): number {
    return index;
  }

  getCurrentOrdersVolume(orders: CurrentOrder[]): number | null {
    return orders.length === 0
      ? null
      : orders.reduce((previousValue, currentValue) => previousValue + currentValue.volume, 0);
  }

  getVolumeStyle(rowType: VerticalOrderBookRowType, volume: number) {
    if (rowType !== VerticalOrderBookRowType.Ask && rowType !== VerticalOrderBookRowType.Bid) {
      return null;
    }

    const size = 100 * (volume / this.maxVolume);
    const color = rowType === VerticalOrderBookRowType.Bid
      ? buyColorBackground
      : sellColorBackground;

    return {
      background: `linear-gradient(90deg, ${color} ${size}% , rgba(0,0,0,0) ${size}%)`,
    };
  }

  cancelOrders(orders: CurrentOrder[]) {
    for (const order of orders) {
      this.orderBookService.cancelOrder({
        orderid: order.orderId,
        exchange: order.exchange,
        portfolio: order.portfolio,
        stop: false
      } as CancelCommand);
    }
  }

  private toViewModel(settings: VerticalOrderBookSettings, instrumentInfo: Instrument, orderBook: VerticalOrderBook): VerticalOrderBookRowView[] {
    const displayYield = settings.showYieldForBonds && getTypeByCfi(instrumentInfo.cfiCode) === InstrumentType.Bond;

    const asks = orderBook.asks.map(x => ({
        ...x,
        rowType: VerticalOrderBookRowType.Ask,
        displayValue: displayYield ? x.yield : x.price
      } as VerticalOrderBookRowView)
    ).sort((a, b) => b.displayValue - a.displayValue);

    if (asks.length > 0) {
      asks[asks.length - 1].isBest = true;
    }

    const bids = orderBook.bids.map(x => ({
        ...x,
        rowType: VerticalOrderBookRowType.Bid,
        displayValue: displayYield ? x.yield : x.price
      } as VerticalOrderBookRowView)
    ).sort((a, b) => b.displayValue - a.displayValue);

    if (bids.length > 0) {
      bids[0].isBest = true;
    }

    const spreadItems = orderBook.spreadItems.map(x => ({
        ...x,
        rowType: VerticalOrderBookRowType.Spread,
        displayValue: x.price
      } as VerticalOrderBookRowView)
    ).sort((a, b) => b.displayValue - a.displayValue);

    return [...asks, ...spreadItems, ...bids];
  }
}
