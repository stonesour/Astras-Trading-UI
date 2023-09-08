import {Component, DestroyRef, Input, OnInit} from '@angular/core';
import {WidgetSettingsService} from '../../../../shared/services/widget-settings.service';
import {DashboardContextService} from '../../../../shared/services/dashboard-context.service';
import {WidgetSettingsCreationHelper} from '../../../../shared/utils/widget-settings/widget-settings-creation-helper';
import {SettingsHelper} from '../../../../shared/utils/settings-helper';
import {distinctUntilChanged, filter, Observable, shareReplay, switchMap, withLatestFrom} from 'rxjs';
import {WidgetInstance} from "../../../../shared/models/dashboard/dashboard-item.model";
import {TerminalSettingsService} from "../../../../shared/services/terminal-settings.service";
import {OrderSubmitSettings} from "../../models/order-submit-settings.model";
import {PortfolioKey} from "../../../../shared/models/portfolio-key.model";
import {Instrument} from "../../../../shared/models/instruments/instrument.model";
import {isPortfoliosEqual} from "../../../../shared/utils/portfolios";
import {InstrumentsService} from "../../../instruments/services/instruments.service";
import {isArrayEqual} from "../../../../shared/utils/collections";
import {CommonParameters, CommonParametersService} from "../../services/common-parameters.service";
import {WidgetsDataProviderService} from "../../../../shared/services/widgets-data-provider.service";
import {SelectedPriceData} from "../../../../shared/models/orders/selected-order-price.model";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";

@Component({
  selector: 'ats-order-submit-widget',
  templateUrl: './order-submit-widget.component.html',
  styleUrls: ['./order-submit-widget.component.less'],
  providers: [CommonParametersService]
})
export class OrderSubmitWidgetComponent implements OnInit {
  currentPortfolio$!: Observable<PortfolioKey>;
  currentInstrument$!: Observable<Instrument>;

  shouldShowSettings: boolean = false;

  @Input({required: true})
  widgetInstance!: WidgetInstance;
  @Input({required: true})
  isBlockWidget!: boolean;

  settings$!: Observable<OrderSubmitSettings>;
  showBadge$!: Observable<boolean>;
  commonParameters$ = this.commonParametersService.parameters$;

  constructor(
    private readonly widgetSettingsService: WidgetSettingsService,
    private readonly dashboardContextService: DashboardContextService,
    private readonly terminalSettingsService: TerminalSettingsService,
    private readonly instrumentService: InstrumentsService,
    private readonly commonParametersService: CommonParametersService,
    private readonly widgetsDataProvider: WidgetsDataProviderService,
    private readonly destroyRef: DestroyRef
  ) {
  }

  get guid(): string {
    return this.widgetInstance.instance.guid;
  }

  onSettingsChange() {
    this.shouldShowSettings = !this.shouldShowSettings;
  }

  ngOnInit(): void {
    WidgetSettingsCreationHelper.createInstrumentLinkedWidgetSettingsIfMissing<OrderSubmitSettings>(
      this.widgetInstance,
      'OrderSubmitSettings',
      settings => ({
        ...settings,
        enableLimitOrdersFastEditing: false,
        limitOrderPriceMoveSteps: [1, 2, 5, 10],
        showVolumePanel: false,
        workingVolumes: [1, 5, 10, 20, 30, 40, 50, 100, 200]
      }),
      this.dashboardContextService,
      this.widgetSettingsService
    );

    this.settings$ = this.widgetSettingsService.getSettings<OrderSubmitSettings>(this.guid).pipe(
      shareReplay(1)
    );

    this.showBadge$ = SettingsHelper.showBadge(this.guid, this.widgetSettingsService, this.terminalSettingsService);

    this.currentPortfolio$ = this.dashboardContextService.selectedPortfolio$.pipe(
      distinctUntilChanged((previous, current) => isPortfoliosEqual(previous, current)),
      shareReplay(1)
    );

    this.currentInstrument$ = this.settings$.pipe(
      distinctUntilChanged((previous, current) => this.isEqualOrderSubmitSettings(previous, current)),
      switchMap(settings => this.instrumentService.getInstrument(settings)),
      filter((i): i is Instrument => !!i),
      shareReplay(1)
    );

    this.widgetsDataProvider.getDataProvider<SelectedPriceData>('selectedPrice')
      ?.pipe(
        takeUntilDestroyed(this.destroyRef),
        withLatestFrom(this.settings$),
        filter(([priceData, settings]) => priceData.badgeColor === settings.badgeColor)
      )
      .subscribe(([priceData]) => this.setCommonParameters({
        price: priceData.price
      }));
  }

  setCommonParameters(params: Partial<CommonParameters>) {
    this.commonParametersService.setParameters(params);
  }

  private isEqualOrderSubmitSettings(
    settings1?: OrderSubmitSettings,
    settings2?: OrderSubmitSettings
  ) {
    if (settings1 && settings2) {
      return (
        settings1.linkToActive == settings2.linkToActive &&
        settings1.guid == settings2.guid &&
        settings1.symbol == settings2.symbol &&
        settings1.exchange == settings2.exchange &&
        settings1.enableLimitOrdersFastEditing == settings2.enableLimitOrdersFastEditing &&
        isArrayEqual(settings1.limitOrderPriceMoveSteps, settings2.limitOrderPriceMoveSteps, (a, b) => a === b) &&
        settings1.showVolumePanel == settings2.showVolumePanel &&
        isArrayEqual(settings1.workingVolumes, settings2.workingVolumes, (a, b) => a === b)
      );
    } else return false;
  }
}