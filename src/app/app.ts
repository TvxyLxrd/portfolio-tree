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
import { ListboxModule } from 'primeng/listbox';
import { MenuModule } from 'primeng/menu';
import { MultiSelectModule } from 'primeng/multiselect';
import { PopoverModule } from 'primeng/popover';
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

interface City {
  name: string;
  code: string;
}

type InstrumentSelectionRule = {
  type: 'exchange' | 'stock';
  exchangeId?: string;
  stockId?: string;
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
    ListboxModule,
    MenuModule,
    MultiSelectModule,
    PopoverModule,
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
  protected readonly instrumentTriggerOptions: { label: string; value: string }[] = [];
  protected readonly cities: City[] = [
    { name: 'New York', code: 'NY' },
    { name: 'Rome', code: 'RM' },
    { name: 'London', code: 'LDN' },
    { name: 'Istanbul', code: 'IST' },
    { name: 'Paris', code: 'PRS' },
  ];
  protected selectedPortfolio: string | null = null;
  protected instrumentTriggerValue: string[] = [];
  protected selectedCities: City[] = [];
  protected instrumentSelectorStep: InstrumentSelectorStep = 'country';
  protected countries: Country[] = [];
  protected exchanges: Exchange[] = [];
  protected stocks: Stock[] = [];
  protected selectedExchangeIds: string[] = [];
  protected selectedStockIds: string[] = [];
  protected selectedCountryId?: string;
  protected selectedExchangeId?: string;
  protected readonly selectorListStyle = { 'max-height': '13.5rem' };
  protected readonly stockListStyle = { 'max-height': '13.5rem' };
  protected stockSearchQuery = '';
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

  protected onCountryChange(countryId: string | null): void {
    const country = this.countries.find((item) => item.id === countryId);

    if (country) {
      this.selectCountry(country);
    }
  }

  protected selectCountry(country: Country): void {
    this.selectedCountryId = country.id;
    this.selectedExchangeId = undefined;
    this.selectedExchangeIds = [];
    this.selectedStockIds = [];
    this.instrumentSelectorStep = 'exchange';
    this.resetStockSearch();
    this.stocks = [];
    this.loadExchanges(country.id);
  }

  protected openCountryFromList(event: Event | { originalEvent?: Event }, country: Country): void {
    const originalEvent = event instanceof Event ? event : event.originalEvent;
    originalEvent?.stopPropagation();
    this.selectCountry(country);
  }

  protected onExchangeChange(exchangeId: string | null): void {
    const exchange = this.exchangesForSelectedCountry.find((item) => item.id === exchangeId);

    if (exchange) {
      this.selectExchange(exchange);
    }
  }

  protected selectExchange(exchange: Exchange): void {
    this.selectedExchangeId = exchange.id;
    if (this.selectedExchangeIds.length === 0) {
      this.selectedExchangeIds = [exchange.id];
    }
    this.instrumentSelectorStep = 'stock';
    this.resetStockSearch();
    this.stocks = [];
    this.loadStocks();
  }

  protected openExchangeFromList(event: Event | { originalEvent?: Event }, exchange: Exchange): void {
    const originalEvent = event instanceof Event ? event : event.originalEvent;
    originalEvent?.stopPropagation();
    this.selectExchange(exchange);
  }

  protected goToPreviousInstrumentStep(): void {
    if (this.instrumentSelectorStep === 'stock') {
      this.instrumentSelectorStep = 'exchange';
      this.selectedExchangeId = undefined;
      this.resetStockSearch();
      this.stocks = [];
      return;
    }

    if (this.instrumentSelectorStep === 'exchange') {
      this.instrumentSelectorStep = 'country';
      this.selectedCountryId = undefined;
      this.selectedExchangeId = undefined;
      this.selectedExchangeIds = [];
      this.selectedStockIds = [];
      this.resetStockSearch();
      this.exchanges = [];
      this.stocks = [];
    }
  }

  protected setStockSearch(event: Event): void {
    this.stockSearchQuery = (event.target as HTMLInputElement).value;
  }

  protected clearStockSearch(): void {
    this.stockSearchQuery = '';
  }

  protected setFilteredStocksSelection(checked: boolean): void {
    const filteredIds = this.filteredStocksForSelectedExchange.map((stock) => stock.id);

    if (checked) {
      this.selectedStockIds = Array.from(new Set([...this.selectedStockIds, ...filteredIds]));
      return;
    }

    this.selectedStockIds = this.selectedStockIds.filter((stockId) => !filteredIds.includes(stockId));
  }

  protected loadStocks(): void {
    const stocksByExchange: Record<string, Stock[]> = {
      nyse: [
        { id: 'lly', exchangeId: 'nyse', ticker: 'LLY', name: 'Eli Lilly' },
        { id: 'xom', exchangeId: 'nyse', ticker: 'XOM', name: 'Exxon Mobil' },
        { id: 'v', exchangeId: 'nyse', ticker: 'V', name: 'Visa' },
        { id: 'ma', exchangeId: 'nyse', ticker: 'MA', name: 'Mastercard' },
        { id: 'wmt', exchangeId: 'nyse', ticker: 'WMT', name: 'Wallmart' },
        { id: 'jpm', exchangeId: 'nyse', ticker: 'JPM', name: 'JPMorgan Chase' },
      ],
      nasdaq: [
        { id: 'aapl', exchangeId: 'nasdaq', ticker: 'AAPL', name: 'Apple' },
        { id: 'msft', exchangeId: 'nasdaq', ticker: 'MSFT', name: 'Microsoft' },
        { id: 'nvda', exchangeId: 'nasdaq', ticker: 'NVDA', name: 'NVIDIA' },
      ],
      otc: [
        { id: 'tcehy', exchangeId: 'otc', ticker: 'TCEHY', name: 'Tencent Holdings' },
        { id: 'rhhby', exchangeId: 'otc', ticker: 'RHHBY', name: 'Roche Holding' },
        { id: 'ntdoy', exchangeId: 'otc', ticker: 'NTDOY', name: 'Nintendo OTC' },
      ],
      sse: [
        { id: '600519', exchangeId: 'sse', ticker: '600519', name: 'Kweichow Moutai' },
        { id: '601166', exchangeId: 'sse', ticker: '601166', name: 'Industrial Bank' },
        { id: '600036', exchangeId: 'sse', ticker: '600036', name: 'China Merchants Bank' },
      ],
      szse: [
        { id: '002594', exchangeId: 'szse', ticker: '002594', name: 'BYD' },
        { id: '300750', exchangeId: 'szse', ticker: '300750', name: 'CATL' },
        { id: '000333', exchangeId: 'szse', ticker: '000333', name: 'Midea Group' },
      ],
      hkex: [
        { id: '0700', exchangeId: 'hkex', ticker: '0700', name: 'Tencent' },
        { id: '9988', exchangeId: 'hkex', ticker: '9988', name: 'Alibaba' },
        { id: '0005', exchangeId: 'hkex', ticker: '0005', name: 'HSBC' },
      ],
      tse: [
        { id: '7203', exchangeId: 'tse', ticker: '7203', name: 'Toyota Motor' },
        { id: '6758', exchangeId: 'tse', ticker: '6758', name: 'Sony Group' },
        { id: '9984', exchangeId: 'tse', ticker: '9984', name: 'SoftBank Group' },
      ],
      ose: [
        { id: '6861', exchangeId: 'ose', ticker: '6861', name: 'Keyence' },
        { id: '7974', exchangeId: 'ose', ticker: '7974', name: 'Nintendo' },
        { id: '9983', exchangeId: 'ose', ticker: '9983', name: 'Fast Retailing' },
      ],
      'nse-jp': [
        { id: '7267', exchangeId: 'nse-jp', ticker: '7267', name: 'Honda Motor' },
        { id: '6501', exchangeId: 'nse-jp', ticker: '6501', name: 'Hitachi' },
        { id: '9432', exchangeId: 'nse-jp', ticker: '9432', name: 'NTT' },
      ],
    };

    this.stocks = this.stockExchangeIds.flatMap((exchangeId) => stocksByExchange[exchangeId] ?? []);
    // TODO: call API to load stocks by selected exchange ids, search, offset and limit.
  }

  protected buildSelectionRules(): InstrumentSelectionRule[] {
    const exchangeRules = Array.from(new Set(this.selectedExchangeIds)).map((exchangeId) => ({
      type: 'exchange' as const,
      exchangeId,
    }));

    const stockRules = Array.from(new Set(this.selectedStockIds)).map((stockId) => ({
      type: 'stock' as const,
      stockId,
    }));

    return [...exchangeRules, ...stockRules];
  }

  protected get exchangesForSelectedCountry(): Exchange[] {
    return this.selectedCountryId
      ? this.exchanges.filter((exchange) => exchange.countryId === this.selectedCountryId)
      : [];
  }

  protected get stocksForSelectedExchange(): Stock[] {
    const exchangeIds = new Set(this.stockExchangeIds);

    return this.stocks.filter((stock) => exchangeIds.has(stock.exchangeId));
  }

  protected get filteredStocksForSelectedExchange(): Stock[] {
    const query = this.stockSearchQuery.trim().toLowerCase();

    if (!query) {
      return this.stocksForSelectedExchange;
    }

    return this.stocksForSelectedExchange.filter((stock) => {
      const ticker = stock.ticker.toLowerCase();
      const name = stock.name.toLowerCase();

      return ticker.includes(query) || name.includes(query);
    });
  }

  protected get allFilteredStocksSelected(): boolean {
    const filteredIds = this.filteredStocksForSelectedExchange.map((stock) => stock.id);

    return (
      filteredIds.length > 0 &&
      filteredIds.every((stockId) => this.selectedStockIds.includes(stockId))
    );
  }

  protected get someFilteredStocksSelected(): boolean {
    const filteredIds = this.filteredStocksForSelectedExchange.map((stock) => stock.id);

    return (
      filteredIds.some((stockId) => this.selectedStockIds.includes(stockId)) &&
      !this.allFilteredStocksSelected
    );
  }

  protected get selectionRules(): InstrumentSelectionRule[] {
    return this.buildSelectionRules();
  }

  protected get instrumentSelectorTitle(): string {
    if (this.instrumentSelectorStep === 'exchange') {
      return this.selectedCountryName ?? 'Stocks';
    }

    if (this.instrumentSelectorStep === 'stock') {
      if (this.stockExchangeIds.length > 1) {
        return `Search ${this.stockExchangeIds.length} exchanges`;
      }

      return `Search ${this.selectedExchangeCode ?? this.selectedExchangeName ?? 'exchange'}`;
    }

    return 'Search for instrument';
  }

  private loadCountries(): void {
    this.countries = [
      { id: 'us', name: 'Stocks USA' },
      { id: 'cn', name: 'Stocks China' },
      { id: 'jp', name: 'Stocks Japan' },
    ];

    // TODO: call API to load countries.
  }

  private loadExchanges(countryId: string): void {
    const exchangesByCountry: Record<string, Exchange[]> = {
      us: [
        { id: 'nyse', countryId: 'us', name: 'NYSE', code: 'NYSE' },
        { id: 'nasdaq', countryId: 'us', name: 'Nasdaq', code: 'NASDAQ' },
        { id: 'otc', countryId: 'us', name: 'OTC Market', code: 'OTC' },
      ],
      cn: [
        { id: 'sse', countryId: 'cn', name: 'Shanghai', code: 'SSE' },
        { id: 'szse', countryId: 'cn', name: 'Shenzhen', code: 'SZSE' },
        { id: 'hkex', countryId: 'cn', name: 'Hong Kong', code: 'HKEX' },
      ],
      jp: [
        { id: 'tse', countryId: 'jp', name: 'Tokyo', code: 'TSE' },
        { id: 'ose', countryId: 'jp', name: 'Osaka', code: 'OSE' },
        { id: 'nse-jp', countryId: 'jp', name: 'Nagoya', code: 'NSE' },
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

  private get selectedExchangeCode(): string | undefined {
    return this.exchanges.find((exchange) => exchange.id === this.selectedExchangeId)?.code;
  }

  private get stockExchangeIds(): string[] {
    return this.selectedExchangeIds.length > 0
      ? Array.from(new Set(this.selectedExchangeIds))
      : this.selectedExchangeId
        ? [this.selectedExchangeId]
        : [];
  }

  private resetStockSearch(): void {
    this.stockSearchQuery = '';
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
