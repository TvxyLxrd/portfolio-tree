import { Component, signal } from '@angular/core';
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
import { CheckboxModule } from 'primeng/checkbox';
import { DrawerModule } from 'primeng/drawer';
import { IconFieldModule } from 'primeng/iconfield';
import { AngleRightIcon } from 'primeng/icons';
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
}

type InstrumentPanelLevel = 'exchanges' | 'tickers';

interface InstrumentPanelChangeEvent {
  itemValue?: InstrumentOption;
}

@Component({
  selector: 'app-root',
  imports: [
    FormsModule,
    AgGridAngular,
    ButtonModule,
    CheckboxModule,
    DrawerModule,
    IconFieldModule,
    AngleRightIcon,
    InputIconModule,
    InputTextModule,
    MenuModule,
    MultiSelectModule,
    SelectModule,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly drawerVisible = signal(false);
  protected readonly activeTreeFilter = signal('');
  protected readonly portfolioOptions: string[] = [];
  protected readonly portfolioMenuItems: MenuItem[] = [
    { label: 'New tree', icon: 'pi pi-plus-circle' },
    { label: 'Edit', icon: 'pi pi-pen-to-square' },
    { label: 'Delete', icon: 'pi pi-trash' },
  ];
  protected readonly exchanges: InstrumentOption[] = [
    { name: 'NYSE', code: 'NYSE' },
    { name: 'Nasdaq', code: 'NASDAQ' },
    { name: 'NYSE American', code: 'NYSE_AMERICAN' },
    { name: 'Cboe BZX', code: 'CBOE_BZX' },
    { name: 'NYSE Arca', code: 'NYSE_ARCA' },
    { name: 'OTC Market', code: 'OTC_MARKET' },
  ];
  protected readonly tickers: InstrumentOption[] = [
    { name: 'AAPL', code: 'AAPL' },
    { name: 'MSFT', code: 'MSFT' },
    { name: 'NVDA', code: 'NVDA' },
    { name: 'TSLA', code: 'TSLA' },
    { name: 'JPM', code: 'JPM' },
    { name: 'V', code: 'V' },
    { name: 'KO', code: 'KO' },
    { name: 'XOM', code: 'XOM' },
    { name: 'PFE', code: 'PFE' },
    { name: 'DIS', code: 'DIS' },
  ];
  protected readonly instrumentPanelLevel = signal<InstrumentPanelLevel>('exchanges');
  protected selectedExchange: InstrumentOption | null = null;
  protected selectedPortfolio: string | null = null;
  protected selectedInstrumentOptions: InstrumentOption[] = [];
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

  protected instrumentOptions(): InstrumentOption[] {
    return this.instrumentPanelLevel() === 'exchanges' ? this.exchanges : this.tickers;
  }

  protected instrumentPanelTitle(): string {
    if (this.instrumentPanelLevel() === 'tickers') {
      return `Search ${this.selectedExchange?.name ?? 'NYSE'}`;
    }

    return 'Stocks USA';
  }

  protected instrumentPanelClass(): string {
    return this.instrumentPanelLevel() === 'exchanges'
      ? 'instrument-exchange-panel'
      : 'instrument-ticker-panel';
  }

  protected onInstrumentPanelChange(event: InstrumentPanelChangeEvent): void {
    if (this.instrumentPanelLevel() !== 'exchanges' || !event.itemValue) {
      return;
    }

    this.openTickerPanel(event.itemValue);
  }

  protected onInstrumentPanelSelectAll(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();

    if (this.instrumentPanelLevel() !== 'exchanges') {
      return;
    }

    this.openTickerPanel({ name: 'Stocks USA', code: 'STOCKS_USA' });
  }

  protected goBackInstrumentPanel(event: MouseEvent): void {
    event.stopPropagation();

    if (this.instrumentPanelLevel() === 'tickers') {
      this.selectedInstrumentOptions = [];
      this.instrumentPanelLevel.set('exchanges');
    }
  }

  private openTickerPanel(exchange: InstrumentOption): void {
    this.selectedExchange = exchange;
    this.selectedInstrumentOptions = [];
    this.instrumentPanelLevel.set('tickers');

    setTimeout(() => {
      this.selectedInstrumentOptions = [];
    });
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
