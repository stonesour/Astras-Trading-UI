import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, ViewEncapsulation } from '@angular/core';
import { BehaviorSubject, merge, Observable, of, Subscription, zip } from 'rxjs';
import { DashboardItem } from '../../../../shared/models/dashboard-item.model';
import { OrderbookService } from '../../services/orderbook.service';
import { OrderBook } from '../../models/orderbook.model';
import { OrderbookSettings } from '../../../../shared/models/settings/orderbook-settings.model';
import { tap } from 'rxjs/operators';
import { Widget } from 'src/app/shared/models/widget.model';
import { CommandParams } from 'src/app/shared/models/commands/command-params.model';
import { SyncService } from 'src/app/shared/services/sync.service';
import { Side } from 'src/app/shared/models/enums/side.model';
import { CommandType } from 'src/app/shared/models/enums/command-type.model';
import {
  sellColorBackground,
  buyColorBackground,
} from '../../../../shared/models/settings/styles-constants';

interface Size {
  width: string;
  height: string;
}

@Component({
  selector: 'ats-order-book[widget][resize][shouldShowSettings][settings]',
  templateUrl: './order-book.component.html',
  styleUrls: ['./order-book.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class OrderBookComponent implements OnInit {
  @Input()
  shouldShowSettings!: boolean;
  @Input()
  widget!: Widget<OrderbookSettings>;
  @Input()
  resize!: EventEmitter<DashboardItem>;
  @Input('settings') set settings(settings: OrderbookSettings) {
    console.log(`From input: ${settings.symbol}`)
    this.service.setSettings(settings);
  }
  @Output()
  shouldShowSettingsChange = new EventEmitter<boolean>();

  resizeSub!: Subscription;
  ob$: Observable<OrderBook | null> = of(null);
  maxVolume: number = 1;

  sizes: BehaviorSubject<Size> = new BehaviorSubject<Size>({
    width: '100%',
    height: '100%',
  });

  constructor(private service: OrderbookService, private sync: SyncService) {}

  ngOnInit(): void {
    this.ob$ = this.service.getOrderbook().pipe(
      tap((ob) => (this.maxVolume = ob?.maxVolume ?? 1))
    );
    this.resizeSub = this.resize.subscribe((widget) => {
      if (widget.item === this.widget.gridItem) {
        // or check id , type or whatever you have there
        // resize your widget, chart, map , etc.
        this.sizes.next({
          // width: (widget.width ?? 0) + 'px',
          width: (widget.width ?? 0) + 'px',
          height: (widget.height ?? 0) + 'px',
        });
        // console.log(widget);
      }
    });
  }

  ngOnDestroy(): void {
    this.service.unsubscribe();
    this.resizeSub.unsubscribe();
  }

  getBidStyle(value: number) {
    const size = 100 * (value / this.maxVolume);
    return {
      background: `linear-gradient(270deg, ${buyColorBackground} ${size}% , rgba(0,0,0,0) ${size}%)`,
    };
  }

  getAskStyle(value: number) {
    const size = 100 * (value / this.maxVolume);
    return {
      background: `linear-gradient(90deg, ${sellColorBackground} ${size}%, rgba(0,0,0,0) ${size}%)`,
    };
  }

  newLimitOrder(side: string, price: number) {
    const settings = this.service.getSettings();
    if (settings) {
      const params: CommandParams = {
        instrument: { ...settings },
        side: side == 'buy' ? Side.Buy : Side.Sell,
        price,
        quantity: 0,
        type: CommandType.Limit,
      };
      this.sync.openCommandModal(params);
    }
  }
}
