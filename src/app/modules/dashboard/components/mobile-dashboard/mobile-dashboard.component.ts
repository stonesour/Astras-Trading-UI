import { Component, OnInit } from '@angular/core';
import { DashboardContextService } from "../../../../shared/services/dashboard-context.service";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { Widget } from "../../../../shared/models/dashboard/widget.model";
import { WidgetsHelper } from "../../../../shared/utils/widgets";

@Component({
  selector: 'ats-mobile-dashboard',
  templateUrl: './mobile-dashboard.component.html',
  styleUrls: ['./mobile-dashboard.component.less']
})
export class MobileDashboardComponent implements OnInit {

  widgets$!: Observable<Widget[]>;
  widgetsHelper = new WidgetsHelper();

  constructor(
    private readonly dashboardContextService: DashboardContextService,
  ) {
  }

  ngOnInit() {
    this.widgets$ = this.dashboardContextService.selectedDashboard$
      .pipe(
        map(d => d.items)
      );
  }
}
