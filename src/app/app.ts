import { Component, HostListener, signal } from '@angular/core';
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
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { MenuModule } from 'primeng/menu';
import { PopoverModule } from 'primeng/popover';
import { ScrollerLazyLoadEvent, ScrollerModule } from 'primeng/scroller';
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

interface Country {
  id: string;
  name: string;
}

interface Exchange {
  id: string;
  countryId: string;
  name: string;
  code?: string;
}

interface Stock {
  id: string;
  exchangeId: string;
  ticker: string;
  name: string;
}

type InstrumentSelectionRule =
  | {
      type: 'exchange';
      exchangeId: string;
      excludedStockIds: string[];
    }
  | {
      type: 'stock';
      stockId: string;
    };

type InstrumentSelectorStep = 'country' | 'exchange' | 'stock';

@Component({
  selector: 'app-root',
  imports: [
    FormsModule,
    AgGridAngular,
    ButtonModule,
    CheckboxModule,
    DrawerModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    MenuModule,
    PopoverModule,
    ScrollerModule,
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
  protected selectedPortfolio: string | null = null;
  protected instrumentSelectorStep: InstrumentSelectorStep = 'country';
  protected countries: Country[] = [];
  protected exchanges: Exchange[] = [];
  protected stocks: Stock[] = [];
  protected selectedExchangeIds = new Set<string>();
  protected selectedStockIds = new Set<string>();
  protected excludedStockIds = new Set<string>();
  protected selectedCountryId?: string;
  protected selectedExchangeId?: string;
  protected stockSearch = '';
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
  private readonly stockExchangeLookup = new Map<string, string>();

  constructor() {
    this.loadCountries();
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
    this.applyResponsiveGrid();
  }

  @HostListener('window:resize')
  protected onWindowResize(): void {
    this.applyResponsiveGrid();
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

  protected selectCountry(country: Country): void {
    this.selectedCountryId = country.id;
    this.selectedExchangeId = undefined;
    this.instrumentSelectorStep = 'exchange';
    this.stockSearch = '';
    this.stocks = [];
    this.loadExchanges(country.id);
  }

  protected selectExchange(exchange: Exchange): void {
    this.selectedExchangeId = exchange.id;
    this.instrumentSelectorStep = 'stock';
    this.stockSearch = '';
    this.stocks = [];
    this.loadStocks({ first: 0, rows: 50 });
  }

  protected goToPreviousInstrumentStep(): void {
    if (this.instrumentSelectorStep === 'stock') {
      this.instrumentSelectorStep = 'exchange';
      this.selectedExchangeId = undefined;
      this.stockSearch = '';
      this.stocks = [];
      return;
    }

    if (this.instrumentSelectorStep === 'exchange') {
      this.instrumentSelectorStep = 'country';
      this.selectedCountryId = undefined;
      this.selectedExchangeId = undefined;
      this.exchanges = [];
      this.stockSearch = '';
      this.stocks = [];
    }
  }

  protected toggleExchange(exchange: Exchange, checked: boolean): void {
    if (checked) {
      this.selectedExchangeIds.add(exchange.id);
    } else {
      this.selectedExchangeIds.delete(exchange.id);
      for (const [stockId, exchangeId] of this.stockExchangeLookup) {
        if (exchangeId === exchange.id) {
          this.excludedStockIds.delete(stockId);
        }
      }
    }
  }

  protected toggleStock(stock: Stock, checked: boolean): void {
    this.stockExchangeLookup.set(stock.id, stock.exchangeId);
    const exchangeSelected = this.selectedExchangeIds.has(stock.exchangeId);

    if (exchangeSelected) {
      if (checked) {
        this.excludedStockIds.delete(stock.id);
      } else {
        this.excludedStockIds.add(stock.id);
      }

      return;
    }

    if (checked) {
      this.selectedStockIds.add(stock.id);
    } else {
      this.selectedStockIds.delete(stock.id);
    }
  }

  protected isExchangeSelected(exchangeId: string): boolean {
    return this.selectedExchangeIds.has(exchangeId);
  }

  protected isStockSelected(stock: Stock): boolean {
    if (this.selectedExchangeIds.has(stock.exchangeId)) {
      return !this.excludedStockIds.has(stock.id);
    }

    return this.selectedStockIds.has(stock.id);
  }

  protected onStockSearchChange(query: string): void {
    this.stockSearch = query;
    this.loadStocks({ first: 0, rows: 50 });
  }

  protected loadStocks(event: ScrollerLazyLoadEvent | { first: number; rows: number }): void {
    void event;
    const stocksByExchange: Record<string, Stock[]> = {
      nyse: [
        { id: 'ko', exchangeId: 'nyse', ticker: 'KO', name: 'Coca-Cola Co' },
        { id: 'jpm', exchangeId: 'nyse', ticker: 'JPM', name: 'JPMorgan Chase & Co' },
        { id: 'dis', exchangeId: 'nyse', ticker: 'DIS', name: 'Walt Disney Co' },
      ],
      nasdaq: [
        { id: 'aapl', exchangeId: 'nasdaq', ticker: 'AAPL', name: 'Apple Inc' },
        { id: 'msft', exchangeId: 'nasdaq', ticker: 'MSFT', name: 'Microsoft Corp' },
        { id: 'nvda', exchangeId: 'nasdaq', ticker: 'NVDA', name: 'NVIDIA Corp' },
      ],
      cboe: [
        { id: 'spy', exchangeId: 'cboe', ticker: 'SPY', name: 'SPDR S&P 500 ETF Trust' },
        { id: 'qqq', exchangeId: 'cboe', ticker: 'QQQ', name: 'Invesco QQQ Trust' },
        { id: 'iwm', exchangeId: 'cboe', ticker: 'IWM', name: 'iShares Russell 2000 ETF' },
      ],
      xetra: [
        { id: 'sap', exchangeId: 'xetra', ticker: 'SAP', name: 'SAP SE' },
        { id: 'sie', exchangeId: 'xetra', ticker: 'SIE', name: 'Siemens AG' },
        { id: 'alv', exchangeId: 'xetra', ticker: 'ALV', name: 'Allianz SE' },
      ],
      frankfurt: [
        { id: 'bmw', exchangeId: 'frankfurt', ticker: 'BMW', name: 'Bayerische Motoren Werke AG' },
        { id: 'bas', exchangeId: 'frankfurt', ticker: 'BAS', name: 'BASF SE' },
        { id: 'dte', exchangeId: 'frankfurt', ticker: 'DTE', name: 'Deutsche Telekom AG' },
      ],
      stuttgart: [
        { id: 'vow3', exchangeId: 'stuttgart', ticker: 'VOW3', name: 'Volkswagen AG' },
        { id: 'dbk', exchangeId: 'stuttgart', ticker: 'DBK', name: 'Deutsche Bank AG' },
        { id: 'ifx', exchangeId: 'stuttgart', ticker: 'IFX', name: 'Infineon Technologies AG' },
      ],
      tase: [
        { id: '7203', exchangeId: 'tase', ticker: '7203', name: 'Toyota Motor Corp' },
        { id: '6758', exchangeId: 'tase', ticker: '6758', name: 'Sony Group Corp' },
        { id: '9984', exchangeId: 'tase', ticker: '9984', name: 'SoftBank Group Corp' },
      ],
      osaka: [
        { id: '6861', exchangeId: 'osaka', ticker: '6861', name: 'Keyence Corp' },
        { id: '7974', exchangeId: 'osaka', ticker: '7974', name: 'Nintendo Co Ltd' },
        { id: '9983', exchangeId: 'osaka', ticker: '9983', name: 'Fast Retailing Co Ltd' },
      ],
      nagoya: [
        { id: '7267', exchangeId: 'nagoya', ticker: '7267', name: 'Honda Motor Co Ltd' },
        { id: '6501', exchangeId: 'nagoya', ticker: '6501', name: 'Hitachi Ltd' },
        { id: '9432', exchangeId: 'nagoya', ticker: '9432', name: 'Nippon Telegraph and Telephone Corp' },
      ],
    };

    const query = this.stockSearch.trim().toLocaleLowerCase();
    const exchangeStocks = this.selectedExchangeId
      ? stocksByExchange[this.selectedExchangeId] ?? []
      : [];

    this.stocks = query
      ? exchangeStocks.filter(
          (stock) =>
            stock.ticker.toLocaleLowerCase().includes(query) ||
            stock.name.toLocaleLowerCase().includes(query),
        )
      : exchangeStocks;
    this.stocks.forEach((stock) => this.stockExchangeLookup.set(stock.id, stock.exchangeId));

    // TODO: call API to load stocks by exchangeId, search, offset and limit.
    // Remember to fill stockExchangeLookup for each loaded stock.
  }

  protected buildSelectionRules(): InstrumentSelectionRule[] {
    const exchangeRules: InstrumentSelectionRule[] = Array.from(this.selectedExchangeIds).map(
      (exchangeId) => ({
        type: 'exchange',
        exchangeId,
        excludedStockIds: Array.from(this.excludedStockIds).filter(
          (stockId) => this.stockExchangeLookup.get(stockId) === exchangeId,
        ),
      }),
    );

    const stockRules: InstrumentSelectionRule[] = Array.from(this.selectedStockIds).map(
      (stockId) => ({
        type: 'stock',
        stockId,
      }),
    );

    return [...exchangeRules, ...stockRules];
  }

  protected get exchangesForSelectedCountry(): Exchange[] {
    return this.selectedCountryId
      ? this.exchanges.filter((exchange) => exchange.countryId === this.selectedCountryId)
      : [];
  }

  protected get stocksForSelectedExchange(): Stock[] {
    return this.selectedExchangeId
      ? this.stocks.filter((stock) => stock.exchangeId === this.selectedExchangeId)
      : [];
  }

  protected get selectionRules(): InstrumentSelectionRule[] {
    return this.buildSelectionRules();
  }

  protected get instrumentSelectorTitle(): string {
    if (this.instrumentSelectorStep === 'exchange') {
      return 'Choose exchange';
    }

    if (this.instrumentSelectorStep === 'stock') {
      return 'Choose token';
    }

    return 'Choose country';
  }

  protected get instrumentSelectorSubtitle(): string {
    const countryName = this.selectedCountryName;
    const exchangeName = this.selectedExchangeName;

    if (this.instrumentSelectorStep === 'exchange') {
      return countryName ?? 'Select a country first';
    }

    if (this.instrumentSelectorStep === 'stock') {
      return [countryName, exchangeName].filter(Boolean).join(' / ') || 'Select an exchange first';
    }

    return 'Start with a country';
  }

  private loadCountries(): void {
    this.countries = [
      { id: 'us', name: 'United States' },
      { id: 'de', name: 'Germany' },
      { id: 'jp', name: 'Japan' },
    ];

    // TODO: call API to load countries.
  }

  private loadExchanges(countryId: string): void {
    const exchangesByCountry: Record<string, Exchange[]> = {
      us: [
        { id: 'nyse', countryId: 'us', name: 'New York Stock Exchange', code: 'NYSE' },
        { id: 'nasdaq', countryId: 'us', name: 'Nasdaq Stock Market', code: 'NASDAQ' },
        { id: 'cboe', countryId: 'us', name: 'Cboe Global Markets', code: 'CBOE' },
      ],
      de: [
        { id: 'xetra', countryId: 'de', name: 'Xetra', code: 'XETR' },
        { id: 'frankfurt', countryId: 'de', name: 'Frankfurt Stock Exchange', code: 'XFRA' },
        { id: 'stuttgart', countryId: 'de', name: 'Stuttgart Stock Exchange', code: 'XSTU' },
      ],
      jp: [
        { id: 'tase', countryId: 'jp', name: 'Tokyo Stock Exchange', code: 'TSE' },
        { id: 'osaka', countryId: 'jp', name: 'Osaka Exchange', code: 'OSE' },
        { id: 'nagoya', countryId: 'jp', name: 'Nagoya Stock Exchange', code: 'NSE' },
      ],
    };

    this.exchanges = exchangesByCountry[countryId] ?? [];

    // TODO: call API to load exchanges by country.
  }

  private get selectedCountryName(): string | undefined {
    return this.countries.find((country) => country.id === this.selectedCountryId)?.name;
  }

  private get selectedExchangeName(): string | undefined {
    return this.exchanges.find((exchange) => exchange.id === this.selectedExchangeId)?.name;
  }

  private applyResponsiveGrid(): void {
    const mobile = window.innerWidth <= 760;
    const columnWidth = mobile ? 96 : 120;

    this.gridApi?.setGridOption('defaultColDef', {
      ...this.defaultColDef,
      width: columnWidth,
      minWidth: mobile ? 72 : 80,
    });
    this.gridApi?.setGridOption('autoGroupColumnDef', {
      ...this.autoGroupColumnDef,
      pinned: mobile ? null : 'left',
      minWidth: mobile ? 160 : 200,
      width: mobile ? 168 : 240,
    });
    this.gridApi?.setColumnWidths(
      this.columnOptions.map((option) => ({
        key: String(option.field),
        newWidth: columnWidth,
      })),
    );
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
