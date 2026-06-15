import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import {
  CellClassParams,
  ColDef,
  GridApi,
  GridReadyEvent,
  ModuleRegistry,
  ValueFormatterParams,
  themeQuartz,
} from 'ag-grid-community';
import { AllEnterpriseModule } from 'ag-grid-enterprise';
import { MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { MenuModule } from 'primeng/menu';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectModule } from 'primeng/select';

ModuleRegistry.registerModules([AllEnterpriseModule]);

interface PortfolioRow {
  name?: string;
  ticker?: string;
  price?: number;
  dayChange?: number;
  weight?: number;
  marketValue?: number;
  pnl?: number;
  pe?: number;
  dividendYield?: number;
  beta?: number;
  sector?: string;
  children?: PortfolioRow[];
}

interface ColumnOption {
  field: keyof PortfolioRow;
  label: string;
}

interface InstrumentOption {
  name: string;
  code: string;
  exchange: string;
  type: string;
}

interface ExchangeInstrumentsResponse {
  exchange: string;
  count: number;
  instruments: InstrumentOption[];
}

@Component({
  selector: 'app-root',
  imports: [
    FormsModule,
    AgGridAngular,
    ButtonModule,
    DrawerModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    MenuModule,
    MultiSelectModule,
    SelectModule,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private readonly httpClient = inject(HttpClient);

  protected readonly drawerVisible = signal(false);
  protected readonly activeTreeFilter = signal('');
  protected readonly instrumentsLoading = signal(false);
  protected readonly instrumentsError = signal('');
  protected readonly portfolioOptions: string[] = [];
  protected readonly portfolioMenuItems: MenuItem[] = [
    { label: 'New tree', icon: 'pi pi-plus-circle' },
    { label: 'Edit', icon: 'pi pi-pen-to-square' },
    { label: 'Delete', icon: 'pi pi-trash' },
  ];
  protected instrumentOptions: InstrumentOption[] = [];
  protected selectedPortfolio: string | null = null;
  protected selectedInstruments: InstrumentOption[] = [];
  protected readonly rowData: PortfolioRow[] = [];
  protected readonly columnOptions: ColumnOption[] = [
    { field: 'ticker', label: 'Ticker' },
    { field: 'price', label: 'Price' },
    { field: 'dayChange', label: 'Day %' },
    { field: 'weight', label: 'Weight' },
    { field: 'marketValue', label: 'Market value' },
    { field: 'pnl', label: 'P&L' },
    { field: 'pe', label: 'P/E' },
    { field: 'dividendYield', label: 'Dividend' },
    { field: 'beta', label: 'Beta' },
    { field: 'sector', label: 'Sector' },
  ];
  protected readonly gridTheme = themeQuartz;

  private gridApi?: GridApi<PortfolioRow>;

  ngOnInit(): void {
    this.loadNyseInstruments();
  }

  protected readonly defaultColDef: ColDef<PortfolioRow> = {
    sortable: false,
    filter: false,
    resizable: true,
    suppressHeaderMenuButton: true,
    suppressHeaderFilterButton: true,
    width: 120,
    minWidth: 80,
  };

  protected readonly autoGroupColumnDef: ColDef<PortfolioRow> = {
    field: 'name',
    headerName: '',
    pinned: 'left',
    width: 240,
    minWidth: 160,
    cellRendererParams: {
      suppressCount: true,
    },
  };

  private readonly changeClassRules = {
    'positive-cell': (params: CellClassParams<PortfolioRow>) => Number(params.value) > 0,
    'negative-cell': (params: CellClassParams<PortfolioRow>) => Number(params.value) < 0,
  };

  protected readonly columnDefs: ColDef<PortfolioRow>[] = [
    {
      field: 'ticker',
      headerName: '',
      cellClass: 'ticker-cell',
    },
    {
      field: 'price',
      headerName: '',
      valueFormatter: this.currencyFormatter,
      type: 'numericColumn',
    },
    {
      field: 'dayChange',
      headerName: '',
      valueFormatter: this.percentFormatter,
      cellClassRules: this.changeClassRules,
      type: 'numericColumn',
    },
    {
      field: 'weight',
      headerName: '',
      valueFormatter: this.percentFormatter,
      type: 'numericColumn',
    },
    {
      field: 'marketValue',
      headerName: '',
      valueFormatter: this.integerCurrencyFormatter,
      type: 'numericColumn',
    },
    {
      field: 'pnl',
      headerName: '',
      valueFormatter: this.signedCurrencyFormatter,
      cellClassRules: this.changeClassRules,
      type: 'numericColumn',
    },
    {
      field: 'pe',
      headerName: '',
      valueFormatter: this.decimalFormatter,
      type: 'numericColumn',
    },
    {
      field: 'dividendYield',
      headerName: '',
      valueFormatter: this.percentFormatter,
      type: 'numericColumn',
    },
    {
      field: 'beta',
      headerName: '',
      valueFormatter: this.decimalFormatter,
      type: 'numericColumn',
    },
    {
      field: 'sector',
      headerName: '',
    },
  ];

  protected onGridReady(event: GridReadyEvent<PortfolioRow>): void {
    this.gridApi = event.api;
  }

  protected setQuickFilter(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.activeTreeFilter.set(value);
    this.gridApi?.setGridOption('quickFilterText', value);
  }

  protected clearFilter(): void {
    this.activeTreeFilter.set('');
    this.gridApi?.setGridOption('quickFilterText', '');
  }

  private loadNyseInstruments(): void {
    this.instrumentsLoading.set(true);
    this.instrumentsError.set('');

    this.httpClient
      .get<ExchangeInstrumentsResponse>('/api/market-data/exchanges/NYSE/instruments')
      .subscribe({
        next: (response) => {
          this.instrumentOptions = response.instruments;
          this.instrumentsLoading.set(false);
        },
        error: () => {
          this.instrumentOptions = [];
          this.instrumentsError.set('Unable to load NYSE instruments');
          this.instrumentsLoading.set(false);
        },
      });
  }

  private currencyFormatter(params: ValueFormatterParams<PortfolioRow, number>): string {
    return params.value == null
      ? ''
      : new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 2,
        }).format(params.value);
  }

  private integerCurrencyFormatter(params: ValueFormatterParams<PortfolioRow, number>): string {
    return params.value == null
      ? ''
      : new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0,
        }).format(params.value);
  }

  private signedCurrencyFormatter(params: ValueFormatterParams<PortfolioRow, number>): string {
    if (params.value == null) {
      return '';
    }

    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(Math.abs(params.value));

    return `${params.value > 0 ? '+' : params.value < 0 ? '-' : ''}${formatted}`;
  }

  private percentFormatter(params: ValueFormatterParams<PortfolioRow, number>): string {
    return params.value == null ? '' : `${params.value.toFixed(2)}%`;
  }

  private decimalFormatter(params: ValueFormatterParams<PortfolioRow, number>): string {
    return params.value == null ? '' : params.value.toFixed(2);
  }
}
