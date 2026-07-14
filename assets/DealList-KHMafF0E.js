var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
import { r as reactExports, C as CreateContext, L as ListFilterContext, u as useFormContext, a as useWrappedSource, b as useWatch, c as useGetManyAggregate, d as useReferenceParams, e as useGetList, f as createLucideIcon, g as useChoicesContext, h as useInput, i as useTranslate, j as useGetRecordRepresentation, k as useChoices, l as useEvent, m as jsxRuntimeExports, F as FormField, n as FormLabel, o as FieldTitle, p as FormControl, q as Command, B as Badge, X, _ as _e, s as CommandList, t as CommandGroup, v as CommandItem, I as InputHelperText, w as FormError, x as CreateBase, y as useResourceContext, z as useGetResourceLabel, A as useCreatePath, D as useHasDashboard, E as Breadcrumb, G as BreadcrumbItem, H as Link, T as Translate, J as BreadcrumbPage, K as cn, M as Input, R as ResourceContextProvider, N as ChoicesContextProvider, O as requireReact, P as React, Q as ReactDOM, S as reactDomExports, U as useConfigurationContext, V as useRedirect, W as RecordContextProvider, Y as Card, Z as CardContent, $ as ReferenceField, a0 as CompanyAvatar, a1 as NumberField, a2 as SelectField, a3 as useLocaleState, a4 as useGetIdentity, a5 as Button, a6 as Dialog, a7 as DialogContent, a8 as DialogTitle, a9 as getRelativeTimeString, aa as useIsMobile, ab as Separator, ac as TextInput, ad as required, ae as ReferenceInput, af as AutocompleteCompanyInput, ag as contactOptionText, ah as SelectInput, ai as useDataProvider, aj as useListContext, ak as useQueryClient, al as Form, am as FormToolbar, an as SaveButton, ao as useNotify, ap as EditBase, aq as FormToolbar$1, ar as useEditContext, as as useRecordContext, at as DeleteButton, au as useLocation, av as matchPath, aw as useAppBarHeight, ax as Progress, ay as CreateButton, az as findDealLabel, aA as isEqual$3, aB as Avatar, aC as ShowBase, aD as EditButton, aE as isValid, aF as formatISODateString, aG as ReferenceArrayField, aH as InfiniteListBase, aI as NotesIterator, aJ as NoteCreate, aK as useRefresh, aL as useMutation, aM as useUpdate, aN as Switch, aO as Label, aP as SearchInput, aQ as AutocompleteInput, aR as List, aS as TopToolbar, aT as FilterButton, aU as ExportButton } from "./index-q6amhYbo.js";
const useCreateContext = /* @__PURE__ */ __name(() => {
  const context = reactExports.useContext(CreateContext);
  if (!context) {
    throw new Error("useCreateContext must be used inside a CreateContextProvider");
  }
  return context;
}, "useCreateContext");
const useListFilterContext = /* @__PURE__ */ __name(() => {
  const context = reactExports.useContext(ListFilterContext);
  if (!context) {
    throw new Error("useListFilterContext must be used inside a ListFilterContextProvider");
  }
  return context;
}, "useListFilterContext");
const useReferenceArrayInputController = /* @__PURE__ */ __name((props) => {
  const { debounce, enableGetChoices, filter, page: initialPage = 1, perPage: initialPerPage = 25, sort: initialSort = { field: "id", order: "DESC" }, queryOptions = {}, reference, source } = props;
  const { getValues } = useFormContext();
  const finalSource = useWrappedSource(source);
  const value = useWatch({ name: finalSource }) ?? getValues(finalSource);
  const { meta, ...otherQueryOptions } = queryOptions;
  const { data: referenceRecords, error: errorGetMany, isLoading: isLoadingGetMany, isFetching: isFetchingGetMany, isPaused: isPausedGetMany, isPending: isPendingGetMany, isPlaceholderData: isPlaceholderDataGetMany, refetch: refetchGetMany } = useGetManyAggregate(reference, {
    ids: value || EmptyArray,
    meta
  }, {
    enabled: value != null && value.length > 0
  });
  const [params, paramsModifiers] = useReferenceParams({
    resource: reference,
    page: initialPage,
    perPage: initialPerPage,
    sort: initialSort,
    debounce,
    filter
  });
  const finalReferenceRecords = referenceRecords ? referenceRecords.filter(Boolean) : [];
  const isGetMatchingEnabled = enableGetChoices ? enableGetChoices(params.filterValues) : true;
  const { data: matchingReferences, total, pageInfo, error: errorGetList, isLoading: isLoadingGetList, isFetching: isFetchingGetList, isPaused: isPausedGetList, isPending: isPendingGetList, isPlaceholderData: isPlaceholderDataGetList, refetch: refetchGetMatching } = useGetList(reference, {
    pagination: {
      page: params.page,
      perPage: params.perPage
    },
    sort: { field: params.sort, order: params.order },
    filter: { ...params.filter, ...filter },
    meta
  }, {
    retry: false,
    enabled: isGetMatchingEnabled,
    placeholderData: /* @__PURE__ */ __name((previousData) => previousData, "placeholderData"),
    ...otherQueryOptions
  });
  const finalMatchingReferences = matchingReferences && matchingReferences.length > 0 ? mergeReferences(matchingReferences, finalReferenceRecords) : finalReferenceRecords.length > 0 ? finalReferenceRecords : matchingReferences;
  const refetch = reactExports.useCallback(() => {
    refetchGetMany();
    refetchGetMatching();
  }, [refetchGetMany, refetchGetMatching]);
  const currentSort = reactExports.useMemo(() => ({
    field: params.sort,
    order: params.order
  }), [params.sort, params.order]);
  return {
    sort: currentSort,
    allChoices: finalMatchingReferences,
    availableChoices: matchingReferences,
    selectedChoices: finalReferenceRecords,
    displayedFilters: params.displayedFilters,
    error: errorGetMany || errorGetList,
    filter,
    filterValues: params.filterValues,
    hideFilter: paramsModifiers.hideFilter,
    isFetching: isFetchingGetMany || isFetchingGetList,
    isLoading: isLoadingGetMany || isLoadingGetList,
    isPaused: isPausedGetMany || isPausedGetList,
    isPending: isPendingGetMany || isPendingGetList,
    isPlaceholderData: isPlaceholderDataGetMany || isPlaceholderDataGetList,
    page: params.page,
    perPage: params.perPage,
    refetch,
    resource: reference,
    setFilters: paramsModifiers.setFilters,
    setPage: paramsModifiers.setPage,
    setPerPage: paramsModifiers.setPerPage,
    setSort: paramsModifiers.setSort,
    showFilter: paramsModifiers.showFilter,
    // we return source and not finalSource because child inputs (e.g. AutocompleteArrayInput) already call useInput and compute the final source
    source,
    total,
    hasNextPage: pageInfo ? pageInfo.hasNextPage : total != null ? params.page * params.perPage < total : void 0,
    hasPreviousPage: pageInfo ? pageInfo.hasPreviousPage : params.page > 1,
    isFromReference: true
  };
}, "useReferenceArrayInputController");
const EmptyArray = [];
const mergeReferences = /* @__PURE__ */ __name((ref1, ref2) => {
  const res = [...ref1];
  const ids = ref1.map((ref) => ref.id);
  ref2.forEach((ref) => {
    if (!ids.includes(ref.id)) {
      ids.push(ref.id);
      res.push(ref);
    }
  });
  return res;
}, "mergeReferences");
const __iconNode$1 = [
  ["rect", { width: "20", height: "5", x: "2", y: "3", rx: "1", key: "1wp1u1" }],
  ["path", { d: "M4 8v11a2 2 0 0 0 2 2h2", key: "tvwodi" }],
  ["path", { d: "M20 8v11a2 2 0 0 1-2 2h-2", key: "1gkqxj" }],
  ["path", { d: "m9 15 3-3 3 3", key: "1pd0qc" }],
  ["path", { d: "M12 12v9", key: "192myk" }]
];
const ArchiveRestore = createLucideIcon("archive-restore", __iconNode$1);
const __iconNode = [
  ["rect", { width: "20", height: "5", x: "2", y: "3", rx: "1", key: "1wp1u1" }],
  ["path", { d: "M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8", key: "1s80jp" }],
  ["path", { d: "M10 12h4", key: "a56b0p" }]
];
const Archive = createLucideIcon("archive", __iconNode);
const AutocompleteArrayInput = /* @__PURE__ */ __name((props) => {
  const { filterToQuery = DefaultFilterToQuery, inputText } = props;
  const {
    allChoices = [],
    source,
    resource,
    isFromReference,
    setFilters
  } = useChoicesContext(props);
  const { id, field, isRequired } = useInput({ ...props, source });
  const translate = useTranslate();
  const { placeholder = translate("ra.action.search", { _: "Search..." }) } = props;
  const getRecordRepresentation = useGetRecordRepresentation(resource);
  const { getChoiceText, getChoiceValue } = useChoices({
    optionText: props.optionText ?? (isFromReference ? getRecordRepresentation : "name"),
    optionValue: props.optionValue ?? "id",
    disableValue: props.disableValue,
    translateChoice: props.translateChoice ?? !isFromReference
  });
  const inputRef = reactExports.useRef(null);
  const listRef = reactExports.useRef(null);
  const [open, setOpen] = reactExports.useState(false);
  const handleUnselect = useEvent((choice) => {
    field.onChange(
      field.value.filter((v) => v !== getChoiceValue(choice))
    );
  });
  const handleKeyDown = useEvent((e) => {
    const input = inputRef.current;
    if (input) {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (input.value === "") {
          field.onChange(field.value.slice(0, -1));
        }
      }
      if (e.key === "Escape") {
        input.blur();
      }
    }
  });
  const availableChoices = allChoices.filter(
    (choice) => !field.value.includes(getChoiceValue(choice))
  );
  const selectedChoices = allChoices.filter(
    (choice) => field.value.includes(getChoiceValue(choice))
  );
  const [filterValue, setFilterValue] = reactExports.useState("");
  const getInputText = reactExports.useCallback(
    (selectedChoice) => {
      if (typeof inputText === "function") {
        return inputText(selectedChoice);
      }
      if (inputText !== void 0) {
        return inputText;
      }
      return getChoiceText(selectedChoice);
    },
    [inputText, getChoiceText]
  );
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(FormField, { className: props.className, id, name: field.name, children: [
    props.label !== false && /* @__PURE__ */ jsxRuntimeExports.jsx(FormLabel, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(
      FieldTitle,
      {
        label: props.label,
        source: props.source ?? source,
        resource,
        isRequired
      }
    ) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(FormControl, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
      Command,
      {
        onKeyDown: handleKeyDown,
        shouldFilter: !isFromReference,
        className: "overflow-visible bg-transparent",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "group rounded-md bg-transparent dark:bg-input/30 border border-input px-3 py-1.75 text-sm transition-all ring-offset-background focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-wrap gap-1", children: [
            selectedChoices.map((choice) => /* @__PURE__ */ jsxRuntimeExports.jsxs(Badge, { variant: "outline", children: [
              getInputText(choice),
              /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "button",
                {
                  className: "ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2",
                  onKeyDown: /* @__PURE__ */ __name((e) => {
                    if (e.key === "Enter") {
                      handleUnselect(choice);
                    }
                  }, "onKeyDown"),
                  onMouseDown: /* @__PURE__ */ __name((e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }, "onMouseDown"),
                  onClick: /* @__PURE__ */ __name((e) => {
                    e.preventDefault();
                    handleUnselect(choice);
                  }, "onClick"),
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "sr-only", children: translate("ra.action.remove", {
                      _: "Remove"
                    }) }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(X, { className: "h-3 w-3" })
                  ]
                }
              )
            ] }, getChoiceValue(choice))),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              _e.Input,
              {
                ref: inputRef,
                value: filterValue,
                onValueChange: /* @__PURE__ */ __name((filter) => {
                  setFilterValue(filter);
                  requestAnimationFrame(() => {
                    listRef.current?.scrollTo(0, 0);
                  });
                  if (isFromReference) {
                    setFilters(filterToQuery(filter), void 0, true);
                  }
                }, "onValueChange"),
                onBlur: /* @__PURE__ */ __name(() => setOpen(false), "onBlur"),
                onFocus: /* @__PURE__ */ __name(() => setOpen(true), "onFocus"),
                placeholder,
                className: "ml-2 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
              }
            )
          ] }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "relative", children: /* @__PURE__ */ jsxRuntimeExports.jsx(CommandList, { ref: listRef, children: open && availableChoices.length > 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "absolute top-2 z-10 w-full rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in", children: /* @__PURE__ */ jsxRuntimeExports.jsx(CommandGroup, { className: "h-full overflow-auto", children: availableChoices.map((choice) => {
            const choiceText = getChoiceText(choice);
            return /* @__PURE__ */ jsxRuntimeExports.jsx(
              CommandItem,
              {
                value: getChoiceValue(choice),
                keywords: reactExports.isValidElement(choiceText) ? void 0 : [choiceText],
                onMouseDown: /* @__PURE__ */ __name((e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }, "onMouseDown"),
                onSelect: /* @__PURE__ */ __name(() => {
                  setFilterValue("");
                  if (isFromReference) {
                    setFilters(filterToQuery(""));
                  }
                  field.onChange([
                    ...field.value,
                    getChoiceValue(choice)
                  ]);
                }, "onSelect"),
                className: "cursor-pointer",
                children: choiceText
              },
              getChoiceValue(choice)
            );
          }) }) }) : null }) })
        ]
      }
    ) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(InputHelperText, { helperText: props.helperText }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(FormError, {})
  ] });
}, "AutocompleteArrayInput");
const DefaultFilterToQuery = /* @__PURE__ */ __name((searchText) => ({ q: searchText }), "DefaultFilterToQuery");
const Create = /* @__PURE__ */ __name(({
  actions,
  children,
  className,
  disableBreadcrumb,
  title,
  ...rest
}) => /* @__PURE__ */ jsxRuntimeExports.jsx(CreateBase, { ...rest, children: /* @__PURE__ */ jsxRuntimeExports.jsx(
  CreateView,
  {
    actions,
    className,
    disableBreadcrumb,
    title,
    children
  }
) }), "Create");
const CreateView = /* @__PURE__ */ __name(({
  actions,
  disableBreadcrumb,
  title,
  children,
  className
}) => {
  const context = useCreateContext();
  const resource = useResourceContext();
  if (!resource) {
    throw new Error(
      "The CreateView component must be used within a ResourceContextProvider"
    );
  }
  const getResourceLabel = useGetResourceLabel();
  const listLabel = getResourceLabel(resource, 2);
  const createPath = useCreatePath();
  const listLink = createPath({
    resource,
    type: "list"
  });
  const hasDashboard = useHasDashboard();
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    !disableBreadcrumb && /* @__PURE__ */ jsxRuntimeExports.jsxs(Breadcrumb, { children: [
      hasDashboard && /* @__PURE__ */ jsxRuntimeExports.jsx(BreadcrumbItem, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Link, { to: "/", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Translate, { i18nKey: "ra.page.dashboard", children: "Home" }) }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(BreadcrumbItem, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Link, { to: listLink, children: listLabel }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(BreadcrumbPage, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Translate, { i18nKey: "ra.action.create", children: "Create" }) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        className: cn(
          "flex justify-between items-start flex-wrap gap-2 my-2",
          className
        ),
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "text-2xl font-bold tracking-tight", children: title !== void 0 ? title : context.defaultTitle }),
          actions
        ]
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "my-2", children })
  ] });
}, "CreateView");
const DateInput = /* @__PURE__ */ __name((props) => {
  const {
    className,
    inputClassName,
    defaultValue,
    format = defaultFormat,
    label,
    source,
    helperText,
    onChange,
    onFocus,
    validate,
    disabled,
    readOnly,
    ...rest
  } = props;
  const resource = useResourceContext(props);
  const {
    field,
    id,
    isRequired
  } = useInput({
    defaultValue,
    source,
    validate,
    disabled,
    readOnly,
    format,
    ...rest
  });
  const localInputRef = reactExports.useRef(null);
  const initialDefaultValueRef = reactExports.useRef(field.value);
  const [inputKey, setInputKey] = reactExports.useState(1);
  const wasLastChangedByInput = reactExports.useRef(false);
  reactExports.useEffect(() => {
    if (wasLastChangedByInput.current) {
      wasLastChangedByInput.current = false;
      return;
    }
    const hasNewValueFromForm = localInputRef.current?.value !== field.value && !(localInputRef.current?.value === "" && field.value == null);
    if (hasNewValueFromForm) {
      initialDefaultValueRef.current = field.value;
      setInputKey((r) => r + 1);
      wasLastChangedByInput.current = false;
    }
  }, [setInputKey, field.value]);
  const { onBlur: onBlurFromField } = field;
  const hasFocus = reactExports.useRef(false);
  const handleChange = useEvent(
    (event) => {
      if (onChange) {
        onChange(event);
      }
      if (typeof event.target === "undefined" || typeof event.target.value === "undefined") {
        return;
      }
      const target = event.target;
      const newValue = target.value;
      const isNewValueValid = newValue === "" || target.valueAsDate != null && !isNaN(new Date(target.valueAsDate).getTime());
      if (newValue !== "" && newValue != null && isNewValueValid) {
        field.onChange(newValue);
        wasLastChangedByInput.current = true;
      }
    }
  );
  const handleFocus = useEvent((event) => {
    if (onFocus) {
      onFocus(event);
    }
    hasFocus.current = true;
  });
  const handleBlur = useEvent(() => {
    hasFocus.current = false;
    if (!localInputRef.current) {
      return;
    }
    const newValue = localInputRef.current.value;
    const isNewValueValid = newValue === "" || localInputRef.current.valueAsDate != null && !isNaN(new Date(localInputRef.current.valueAsDate).getTime());
    if (isNewValueValid && field.value !== newValue) {
      field.onChange(newValue ?? "");
    }
    if (onBlurFromField) {
      onBlurFromField();
    }
  });
  const { ref, name } = field;
  const inputRef = reactExports.useCallback(
    (node) => {
      if (typeof ref === "function") {
        ref(node);
      } else if (ref && node) {
        ref.current = node;
      }
      localInputRef.current = node;
    },
    [ref]
  );
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(FormField, { id, className, name, children: [
    label !== false && /* @__PURE__ */ jsxRuntimeExports.jsx(FormLabel, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(
      FieldTitle,
      {
        label,
        source,
        resource,
        isRequired
      }
    ) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(FormControl, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(
      Input,
      {
        ref: inputRef,
        defaultValue: format(initialDefaultValueRef.current) ?? "",
        type: "date",
        onChange: handleChange,
        onFocus: handleFocus,
        onBlur: handleBlur,
        className: cn(
          "ra-input",
          `ra-input-${source}`,
          "scheme-light dark:scheme-dark relative [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 [&::-webkit-calendar-picker-indicator]:opacity-100 appearance-none",
          inputClassName
        ),
        disabled: disabled || readOnly,
        readOnly,
        ...rest
      },
      inputKey
    ) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(InputHelperText, { helperText }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(FormError, {})
  ] });
}, "DateInput");
const convertDateToString = /* @__PURE__ */ __name((value) => {
  if (!(value instanceof Date) || isNaN(value.getDate())) return "";
  const localDate = new Date(value.getTime());
  const pad = "00";
  const yyyy = localDate.getFullYear().toString();
  const MM = (localDate.getMonth() + 1).toString();
  const dd = localDate.getDate().toString();
  return `${yyyy}-${(pad + MM).slice(-2)}-${(pad + dd).slice(-2)}`;
}, "convertDateToString");
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const defaultFormat = /* @__PURE__ */ __name((value) => {
  if (value == null || value === "") {
    return null;
  }
  if (value instanceof Date) {
    return convertDateToString(value);
  }
  if (typeof value === "string") {
    if (dateRegex.test(value)) {
      return value;
    }
  }
  return convertDateToString(new Date(value));
}, "defaultFormat");
const ReferenceArrayInput = /* @__PURE__ */ __name((props) => {
  const {
    children = defaultChildren,
    reference,
    sort,
    filter = defaultFilter
  } = props;
  if (reactExports.Children.count(children) !== 1) {
    throw new Error(
      "<ReferenceArrayInput> only accepts a single child (like <AutocompleteArrayInput>)"
    );
  }
  const controllerProps = useReferenceArrayInputController({
    ...props,
    sort,
    filter
  });
  return /* @__PURE__ */ jsxRuntimeExports.jsx(ResourceContextProvider, { value: reference, children: /* @__PURE__ */ jsxRuntimeExports.jsx(ChoicesContextProvider, { value: controllerProps, children }) });
}, "ReferenceArrayInput");
const defaultChildren = /* @__PURE__ */ jsxRuntimeExports.jsx(AutocompleteArrayInput, {});
const defaultFilter = {};
const NumberInput = /* @__PURE__ */ __name((props) => {
  const {
    label,
    source,
    className,
    resource: resourceProp,
    validate: _validateProp,
    format: _formatProp,
    parse: parse3 = convertStringToNumber,
    onFocus,
    helperText,
    ...rest
  } = props;
  const resource = useResourceContext({ resource: resourceProp });
  const { id, field, isRequired } = useInput(props);
  const handleChange = /* @__PURE__ */ __name((event) => {
    const value2 = event.target.value;
    const numberValue = parse3(value2);
    setValue(value2);
    field.onChange(numberValue ?? 0);
  }, "handleChange");
  const [value, setValue] = reactExports.useState(
    field.value?.toString() ?? ""
  );
  const hasFocus = reactExports.useRef(false);
  const handleFocus = /* @__PURE__ */ __name((event) => {
    onFocus?.(event);
    hasFocus.current = true;
  }, "handleFocus");
  const handleBlur = /* @__PURE__ */ __name((event) => {
    field.onBlur?.(event);
    hasFocus.current = false;
    setValue(field.value?.toString() ?? "");
  }, "handleBlur");
  reactExports.useEffect(() => {
    if (!hasFocus.current) {
      setValue(field.value?.toString() ?? "");
    }
  }, [field.value]);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(FormField, { id, className, name: field.name, children: [
    label !== false && /* @__PURE__ */ jsxRuntimeExports.jsx(FormLabel, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(
      FieldTitle,
      {
        label,
        source,
        resource,
        isRequired
      }
    ) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(FormControl, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(
      Input,
      {
        ...rest,
        ...field,
        type: "number",
        value,
        onChange: handleChange,
        onFocus: handleFocus,
        onBlur: handleBlur
      }
    ) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(InputHelperText, { helperText }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(FormError, {})
  ] });
}, "NumberInput");
const convertStringToNumber = /* @__PURE__ */ __name((value) => {
  if (value == null || value === "") {
    return null;
  }
  const float = parseFloat(value);
  return isNaN(float) ? 0 : float;
}, "convertStringToNumber");
function formatProdErrorMessage(code) {
  return `Minified Redux error #${code}; visit https://redux.js.org/Errors?code=${code} for the full message or use the non-minified dev environment for full errors. `;
}
__name(formatProdErrorMessage, "formatProdErrorMessage");
var $$observable = /* @__PURE__ */ (() => typeof Symbol === "function" && Symbol.observable || "@@observable")();
var symbol_observable_default = $$observable;
var randomString = /* @__PURE__ */ __name(() => Math.random().toString(36).substring(7).split("").join("."), "randomString");
var ActionTypes = {
  INIT: `@@redux/INIT${/* @__PURE__ */ randomString()}`,
  REPLACE: `@@redux/REPLACE${/* @__PURE__ */ randomString()}`
};
var actionTypes_default = ActionTypes;
function isPlainObject(obj) {
  if (typeof obj !== "object" || obj === null)
    return false;
  let proto = obj;
  while (Object.getPrototypeOf(proto) !== null) {
    proto = Object.getPrototypeOf(proto);
  }
  return Object.getPrototypeOf(obj) === proto || Object.getPrototypeOf(obj) === null;
}
__name(isPlainObject, "isPlainObject");
function createStore$1(reducer2, preloadedState, enhancer) {
  if (typeof reducer2 !== "function") {
    throw new Error(formatProdErrorMessage(2));
  }
  if (typeof preloadedState === "function" && typeof enhancer === "function" || typeof enhancer === "function" && typeof arguments[3] === "function") {
    throw new Error(formatProdErrorMessage(0));
  }
  if (typeof preloadedState === "function" && typeof enhancer === "undefined") {
    enhancer = preloadedState;
    preloadedState = void 0;
  }
  if (typeof enhancer !== "undefined") {
    if (typeof enhancer !== "function") {
      throw new Error(formatProdErrorMessage(1));
    }
    return enhancer(createStore$1)(reducer2, preloadedState);
  }
  let currentReducer = reducer2;
  let currentState = preloadedState;
  let currentListeners = /* @__PURE__ */ new Map();
  let nextListeners = currentListeners;
  let listenerIdCounter = 0;
  let isDispatching = false;
  function ensureCanMutateNextListeners() {
    if (nextListeners === currentListeners) {
      nextListeners = /* @__PURE__ */ new Map();
      currentListeners.forEach((listener, key) => {
        nextListeners.set(key, listener);
      });
    }
  }
  __name(ensureCanMutateNextListeners, "ensureCanMutateNextListeners");
  function getState() {
    if (isDispatching) {
      throw new Error(formatProdErrorMessage(3));
    }
    return currentState;
  }
  __name(getState, "getState");
  function subscribe(listener) {
    if (typeof listener !== "function") {
      throw new Error(formatProdErrorMessage(4));
    }
    if (isDispatching) {
      throw new Error(formatProdErrorMessage(5));
    }
    let isSubscribed = true;
    ensureCanMutateNextListeners();
    const listenerId = listenerIdCounter++;
    nextListeners.set(listenerId, listener);
    return /* @__PURE__ */ __name(function unsubscribe() {
      if (!isSubscribed) {
        return;
      }
      if (isDispatching) {
        throw new Error(formatProdErrorMessage(6));
      }
      isSubscribed = false;
      ensureCanMutateNextListeners();
      nextListeners.delete(listenerId);
      currentListeners = null;
    }, "unsubscribe");
  }
  __name(subscribe, "subscribe");
  function dispatch(action) {
    if (!isPlainObject(action)) {
      throw new Error(formatProdErrorMessage(7));
    }
    if (typeof action.type === "undefined") {
      throw new Error(formatProdErrorMessage(8));
    }
    if (typeof action.type !== "string") {
      throw new Error(formatProdErrorMessage(17));
    }
    if (isDispatching) {
      throw new Error(formatProdErrorMessage(9));
    }
    try {
      isDispatching = true;
      currentState = currentReducer(currentState, action);
    } finally {
      isDispatching = false;
    }
    const listeners = currentListeners = nextListeners;
    listeners.forEach((listener) => {
      listener();
    });
    return action;
  }
  __name(dispatch, "dispatch");
  function replaceReducer(nextReducer) {
    if (typeof nextReducer !== "function") {
      throw new Error(formatProdErrorMessage(10));
    }
    currentReducer = nextReducer;
    dispatch({
      type: actionTypes_default.REPLACE
    });
  }
  __name(replaceReducer, "replaceReducer");
  function observable() {
    const outerSubscribe = subscribe;
    return {
      /**
       * The minimal observable subscription method.
       * @param observer Any object that can be used as an observer.
       * The observer object should have a `next` method.
       * @returns An object with an `unsubscribe` method that can
       * be used to unsubscribe the observable from the store, and prevent further
       * emission of values from the observable.
       */
      subscribe(observer) {
        if (typeof observer !== "object" || observer === null) {
          throw new Error(formatProdErrorMessage(11));
        }
        function observeState() {
          const observerAsObserver = observer;
          if (observerAsObserver.next) {
            observerAsObserver.next(getState());
          }
        }
        __name(observeState, "observeState");
        observeState();
        const unsubscribe = outerSubscribe(observeState);
        return {
          unsubscribe
        };
      },
      [symbol_observable_default]() {
        return this;
      }
    };
  }
  __name(observable, "observable");
  dispatch({
    type: actionTypes_default.INIT
  });
  const store = {
    dispatch,
    subscribe,
    getState,
    replaceReducer,
    [symbol_observable_default]: observable
  };
  return store;
}
__name(createStore$1, "createStore$1");
function bindActionCreator(actionCreator, dispatch) {
  return function(...args) {
    return dispatch(actionCreator.apply(this, args));
  };
}
__name(bindActionCreator, "bindActionCreator");
function bindActionCreators$1(actionCreators, dispatch) {
  if (typeof actionCreators === "function") {
    return bindActionCreator(actionCreators, dispatch);
  }
  if (typeof actionCreators !== "object" || actionCreators === null) {
    throw new Error(formatProdErrorMessage(16));
  }
  const boundActionCreators = {};
  for (const key in actionCreators) {
    const actionCreator = actionCreators[key];
    if (typeof actionCreator === "function") {
      boundActionCreators[key] = bindActionCreator(actionCreator, dispatch);
    }
  }
  return boundActionCreators;
}
__name(bindActionCreators$1, "bindActionCreators$1");
function compose(...funcs) {
  if (funcs.length === 0) {
    return (arg) => arg;
  }
  if (funcs.length === 1) {
    return funcs[0];
  }
  return funcs.reduce((a, b) => (...args) => a(b(...args)));
}
__name(compose, "compose");
function applyMiddleware(...middlewares) {
  return (createStore2) => (reducer2, preloadedState) => {
    const store = createStore2(reducer2, preloadedState);
    let dispatch = /* @__PURE__ */ __name(() => {
      throw new Error(formatProdErrorMessage(15));
    }, "dispatch");
    const middlewareAPI = {
      getState: store.getState,
      dispatch: /* @__PURE__ */ __name((action, ...args) => dispatch(action, ...args), "dispatch")
    };
    const chain = middlewares.map((middleware) => middleware(middlewareAPI));
    dispatch = compose(...chain)(store.dispatch);
    return {
      ...store,
      dispatch
    };
  };
}
__name(applyMiddleware, "applyMiddleware");
var withSelector = { exports: {} };
var useSyncExternalStoreWithSelector_production = {};
var hasRequiredUseSyncExternalStoreWithSelector_production;
function requireUseSyncExternalStoreWithSelector_production() {
  if (hasRequiredUseSyncExternalStoreWithSelector_production) return useSyncExternalStoreWithSelector_production;
  hasRequiredUseSyncExternalStoreWithSelector_production = 1;
  var React2 = requireReact();
  function is2(x, y) {
    return x === y && (0 !== x || 1 / x === 1 / y) || x !== x && y !== y;
  }
  __name(is2, "is");
  var objectIs = "function" === typeof Object.is ? Object.is : is2, useSyncExternalStore = React2.useSyncExternalStore, useRef = React2.useRef, useEffect = React2.useEffect, useMemo2 = React2.useMemo, useDebugValue = React2.useDebugValue;
  useSyncExternalStoreWithSelector_production.useSyncExternalStoreWithSelector = function(subscribe, getSnapshot, getServerSnapshot, selector, isEqual2) {
    var instRef = useRef(null);
    if (null === instRef.current) {
      var inst = { hasValue: false, value: null };
      instRef.current = inst;
    } else inst = instRef.current;
    instRef = useMemo2(
      function() {
        function memoizedSelector(nextSnapshot) {
          if (!hasMemo) {
            hasMemo = true;
            memoizedSnapshot = nextSnapshot;
            nextSnapshot = selector(nextSnapshot);
            if (void 0 !== isEqual2 && inst.hasValue) {
              var currentSelection = inst.value;
              if (isEqual2(currentSelection, nextSnapshot))
                return memoizedSelection = currentSelection;
            }
            return memoizedSelection = nextSnapshot;
          }
          currentSelection = memoizedSelection;
          if (objectIs(memoizedSnapshot, nextSnapshot)) return currentSelection;
          var nextSelection = selector(nextSnapshot);
          if (void 0 !== isEqual2 && isEqual2(currentSelection, nextSelection))
            return memoizedSnapshot = nextSnapshot, currentSelection;
          memoizedSnapshot = nextSnapshot;
          return memoizedSelection = nextSelection;
        }
        __name(memoizedSelector, "memoizedSelector");
        var hasMemo = false, memoizedSnapshot, memoizedSelection, maybeGetServerSnapshot = void 0 === getServerSnapshot ? null : getServerSnapshot;
        return [
          function() {
            return memoizedSelector(getSnapshot());
          },
          null === maybeGetServerSnapshot ? void 0 : function() {
            return memoizedSelector(maybeGetServerSnapshot());
          }
        ];
      },
      [getSnapshot, getServerSnapshot, selector, isEqual2]
    );
    var value = useSyncExternalStore(subscribe, instRef[0], instRef[1]);
    useEffect(
      function() {
        inst.hasValue = true;
        inst.value = value;
      },
      [value]
    );
    useDebugValue(value);
    return value;
  };
  return useSyncExternalStoreWithSelector_production;
}
__name(requireUseSyncExternalStoreWithSelector_production, "requireUseSyncExternalStoreWithSelector_production");
var hasRequiredWithSelector;
function requireWithSelector() {
  if (hasRequiredWithSelector) return withSelector.exports;
  hasRequiredWithSelector = 1;
  {
    withSelector.exports = requireUseSyncExternalStoreWithSelector_production();
  }
  return withSelector.exports;
}
__name(requireWithSelector, "requireWithSelector");
requireWithSelector();
var IS_REACT_19 = /* @__PURE__ */ reactExports.version.startsWith("19");
var REACT_ELEMENT_TYPE = /* @__PURE__ */ Symbol.for(
  IS_REACT_19 ? "react.transitional.element" : "react.element"
);
var REACT_PORTAL_TYPE = /* @__PURE__ */ Symbol.for("react.portal");
var REACT_FRAGMENT_TYPE = /* @__PURE__ */ Symbol.for("react.fragment");
var REACT_STRICT_MODE_TYPE = /* @__PURE__ */ Symbol.for("react.strict_mode");
var REACT_PROFILER_TYPE = /* @__PURE__ */ Symbol.for("react.profiler");
var REACT_CONSUMER_TYPE = /* @__PURE__ */ Symbol.for("react.consumer");
var REACT_CONTEXT_TYPE = /* @__PURE__ */ Symbol.for("react.context");
var REACT_FORWARD_REF_TYPE = /* @__PURE__ */ Symbol.for("react.forward_ref");
var REACT_SUSPENSE_TYPE = /* @__PURE__ */ Symbol.for("react.suspense");
var REACT_SUSPENSE_LIST_TYPE = /* @__PURE__ */ Symbol.for(
  "react.suspense_list"
);
var REACT_MEMO_TYPE = /* @__PURE__ */ Symbol.for("react.memo");
var REACT_LAZY_TYPE = /* @__PURE__ */ Symbol.for("react.lazy");
var ForwardRef = REACT_FORWARD_REF_TYPE;
var Memo = REACT_MEMO_TYPE;
function typeOf(object) {
  if (typeof object === "object" && object !== null) {
    const { $$typeof } = object;
    switch ($$typeof) {
      case REACT_ELEMENT_TYPE:
        switch (object = object.type, object) {
          case REACT_FRAGMENT_TYPE:
          case REACT_PROFILER_TYPE:
          case REACT_STRICT_MODE_TYPE:
          case REACT_SUSPENSE_TYPE:
          case REACT_SUSPENSE_LIST_TYPE:
            return object;
          default:
            switch (object = object && object.$$typeof, object) {
              case REACT_CONTEXT_TYPE:
              case REACT_FORWARD_REF_TYPE:
              case REACT_LAZY_TYPE:
              case REACT_MEMO_TYPE:
                return object;
              case REACT_CONSUMER_TYPE:
                return object;
              default:
                return $$typeof;
            }
        }
      case REACT_PORTAL_TYPE:
        return $$typeof;
    }
  }
}
__name(typeOf, "typeOf");
function isMemo(object) {
  return typeOf(object) === REACT_MEMO_TYPE;
}
__name(isMemo, "isMemo");
function pureFinalPropsSelectorFactory(mapStateToProps, mapDispatchToProps2, mergeProps, dispatch, {
  areStatesEqual,
  areOwnPropsEqual,
  areStatePropsEqual
}) {
  let hasRunAtLeastOnce = false;
  let state;
  let ownProps;
  let stateProps;
  let dispatchProps;
  let mergedProps;
  function handleFirstCall(firstState, firstOwnProps) {
    state = firstState;
    ownProps = firstOwnProps;
    stateProps = mapStateToProps(state, ownProps);
    dispatchProps = mapDispatchToProps2(dispatch, ownProps);
    mergedProps = mergeProps(stateProps, dispatchProps, ownProps);
    hasRunAtLeastOnce = true;
    return mergedProps;
  }
  __name(handleFirstCall, "handleFirstCall");
  function handleNewPropsAndNewState() {
    stateProps = mapStateToProps(state, ownProps);
    if (mapDispatchToProps2.dependsOnOwnProps)
      dispatchProps = mapDispatchToProps2(dispatch, ownProps);
    mergedProps = mergeProps(stateProps, dispatchProps, ownProps);
    return mergedProps;
  }
  __name(handleNewPropsAndNewState, "handleNewPropsAndNewState");
  function handleNewProps() {
    if (mapStateToProps.dependsOnOwnProps)
      stateProps = mapStateToProps(state, ownProps);
    if (mapDispatchToProps2.dependsOnOwnProps)
      dispatchProps = mapDispatchToProps2(dispatch, ownProps);
    mergedProps = mergeProps(stateProps, dispatchProps, ownProps);
    return mergedProps;
  }
  __name(handleNewProps, "handleNewProps");
  function handleNewState() {
    const nextStateProps = mapStateToProps(state, ownProps);
    const statePropsChanged = !areStatePropsEqual(nextStateProps, stateProps);
    stateProps = nextStateProps;
    if (statePropsChanged)
      mergedProps = mergeProps(stateProps, dispatchProps, ownProps);
    return mergedProps;
  }
  __name(handleNewState, "handleNewState");
  function handleSubsequentCalls(nextState, nextOwnProps) {
    const propsChanged = !areOwnPropsEqual(nextOwnProps, ownProps);
    const stateChanged = !areStatesEqual(
      nextState,
      state,
      nextOwnProps,
      ownProps
    );
    state = nextState;
    ownProps = nextOwnProps;
    if (propsChanged && stateChanged) return handleNewPropsAndNewState();
    if (propsChanged) return handleNewProps();
    if (stateChanged) return handleNewState();
    return mergedProps;
  }
  __name(handleSubsequentCalls, "handleSubsequentCalls");
  return /* @__PURE__ */ __name(function pureFinalPropsSelector(nextState, nextOwnProps) {
    return hasRunAtLeastOnce ? handleSubsequentCalls(nextState, nextOwnProps) : handleFirstCall(nextState, nextOwnProps);
  }, "pureFinalPropsSelector");
}
__name(pureFinalPropsSelectorFactory, "pureFinalPropsSelectorFactory");
function finalPropsSelectorFactory(dispatch, {
  initMapStateToProps,
  initMapDispatchToProps,
  initMergeProps,
  ...options
}) {
  const mapStateToProps = initMapStateToProps(dispatch, options);
  const mapDispatchToProps2 = initMapDispatchToProps(dispatch, options);
  const mergeProps = initMergeProps(dispatch, options);
  return pureFinalPropsSelectorFactory(mapStateToProps, mapDispatchToProps2, mergeProps, dispatch, options);
}
__name(finalPropsSelectorFactory, "finalPropsSelectorFactory");
function bindActionCreators(actionCreators, dispatch) {
  const boundActionCreators = {};
  for (const key in actionCreators) {
    const actionCreator = actionCreators[key];
    if (typeof actionCreator === "function") {
      boundActionCreators[key] = (...args) => dispatch(actionCreator(...args));
    }
  }
  return boundActionCreators;
}
__name(bindActionCreators, "bindActionCreators");
function wrapMapToPropsConstant(getConstant) {
  return /* @__PURE__ */ __name(function initConstantSelector(dispatch) {
    const constant = getConstant(dispatch);
    function constantSelector() {
      return constant;
    }
    __name(constantSelector, "constantSelector");
    constantSelector.dependsOnOwnProps = false;
    return constantSelector;
  }, "initConstantSelector");
}
__name(wrapMapToPropsConstant, "wrapMapToPropsConstant");
function getDependsOnOwnProps(mapToProps) {
  return mapToProps.dependsOnOwnProps ? Boolean(mapToProps.dependsOnOwnProps) : mapToProps.length !== 1;
}
__name(getDependsOnOwnProps, "getDependsOnOwnProps");
function wrapMapToPropsFunc(mapToProps, methodName) {
  return /* @__PURE__ */ __name(function initProxySelector(dispatch, { displayName }) {
    const proxy = /* @__PURE__ */ __name(function mapToPropsProxy(stateOrDispatch, ownProps) {
      return proxy.dependsOnOwnProps ? proxy.mapToProps(stateOrDispatch, ownProps) : proxy.mapToProps(stateOrDispatch, void 0);
    }, "mapToPropsProxy");
    proxy.dependsOnOwnProps = true;
    proxy.mapToProps = /* @__PURE__ */ __name(function detectFactoryAndVerify(stateOrDispatch, ownProps) {
      proxy.mapToProps = mapToProps;
      proxy.dependsOnOwnProps = getDependsOnOwnProps(mapToProps);
      let props = proxy(stateOrDispatch, ownProps);
      if (typeof props === "function") {
        proxy.mapToProps = props;
        proxy.dependsOnOwnProps = getDependsOnOwnProps(props);
        props = proxy(stateOrDispatch, ownProps);
      }
      return props;
    }, "detectFactoryAndVerify");
    return proxy;
  }, "initProxySelector");
}
__name(wrapMapToPropsFunc, "wrapMapToPropsFunc");
function createInvalidArgFactory(arg, name) {
  return (dispatch, options) => {
    throw new Error(
      `Invalid value of type ${typeof arg} for ${name} argument when connecting component ${options.wrappedComponentName}.`
    );
  };
}
__name(createInvalidArgFactory, "createInvalidArgFactory");
function mapDispatchToPropsFactory(mapDispatchToProps2) {
  return mapDispatchToProps2 && typeof mapDispatchToProps2 === "object" ? wrapMapToPropsConstant(
    (dispatch) => (
      // @ts-ignore
      bindActionCreators(mapDispatchToProps2, dispatch)
    )
  ) : !mapDispatchToProps2 ? wrapMapToPropsConstant((dispatch) => ({
    dispatch
  })) : typeof mapDispatchToProps2 === "function" ? (
    // @ts-ignore
    wrapMapToPropsFunc(mapDispatchToProps2)
  ) : createInvalidArgFactory(mapDispatchToProps2, "mapDispatchToProps");
}
__name(mapDispatchToPropsFactory, "mapDispatchToPropsFactory");
function mapStateToPropsFactory(mapStateToProps) {
  return !mapStateToProps ? wrapMapToPropsConstant(() => ({})) : typeof mapStateToProps === "function" ? (
    // @ts-ignore
    wrapMapToPropsFunc(mapStateToProps)
  ) : createInvalidArgFactory(mapStateToProps, "mapStateToProps");
}
__name(mapStateToPropsFactory, "mapStateToPropsFactory");
function defaultMergeProps(stateProps, dispatchProps, ownProps) {
  return { ...ownProps, ...stateProps, ...dispatchProps };
}
__name(defaultMergeProps, "defaultMergeProps");
function wrapMergePropsFunc(mergeProps) {
  return /* @__PURE__ */ __name(function initMergePropsProxy(dispatch, { displayName, areMergedPropsEqual }) {
    let hasRunOnce = false;
    let mergedProps;
    return /* @__PURE__ */ __name(function mergePropsProxy(stateProps, dispatchProps, ownProps) {
      const nextMergedProps = mergeProps(stateProps, dispatchProps, ownProps);
      if (hasRunOnce) {
        if (!areMergedPropsEqual(nextMergedProps, mergedProps))
          mergedProps = nextMergedProps;
      } else {
        hasRunOnce = true;
        mergedProps = nextMergedProps;
      }
      return mergedProps;
    }, "mergePropsProxy");
  }, "initMergePropsProxy");
}
__name(wrapMergePropsFunc, "wrapMergePropsFunc");
function mergePropsFactory(mergeProps) {
  return !mergeProps ? () => defaultMergeProps : typeof mergeProps === "function" ? wrapMergePropsFunc(mergeProps) : createInvalidArgFactory(mergeProps, "mergeProps");
}
__name(mergePropsFactory, "mergePropsFactory");
function defaultNoopBatch(callback) {
  callback();
}
__name(defaultNoopBatch, "defaultNoopBatch");
function createListenerCollection() {
  let first = null;
  let last = null;
  return {
    clear() {
      first = null;
      last = null;
    },
    notify() {
      defaultNoopBatch(() => {
        let listener = first;
        while (listener) {
          listener.callback();
          listener = listener.next;
        }
      });
    },
    get() {
      const listeners = [];
      let listener = first;
      while (listener) {
        listeners.push(listener);
        listener = listener.next;
      }
      return listeners;
    },
    subscribe(callback) {
      let isSubscribed = true;
      const listener = last = {
        callback,
        next: null,
        prev: last
      };
      if (listener.prev) {
        listener.prev.next = listener;
      } else {
        first = listener;
      }
      return /* @__PURE__ */ __name(function unsubscribe() {
        if (!isSubscribed || first === null) return;
        isSubscribed = false;
        if (listener.next) {
          listener.next.prev = listener.prev;
        } else {
          last = listener.prev;
        }
        if (listener.prev) {
          listener.prev.next = listener.next;
        } else {
          first = listener.next;
        }
      }, "unsubscribe");
    }
  };
}
__name(createListenerCollection, "createListenerCollection");
var nullListeners = {
  notify() {
  },
  get: /* @__PURE__ */ __name(() => [], "get")
};
function createSubscription(store, parentSub) {
  let unsubscribe;
  let listeners = nullListeners;
  let subscriptionsAmount = 0;
  let selfSubscribed = false;
  function addNestedSub(listener) {
    trySubscribe();
    const cleanupListener = listeners.subscribe(listener);
    let removed = false;
    return () => {
      if (!removed) {
        removed = true;
        cleanupListener();
        tryUnsubscribe();
      }
    };
  }
  __name(addNestedSub, "addNestedSub");
  function notifyNestedSubs() {
    listeners.notify();
  }
  __name(notifyNestedSubs, "notifyNestedSubs");
  function handleChangeWrapper() {
    if (subscription.onStateChange) {
      subscription.onStateChange();
    }
  }
  __name(handleChangeWrapper, "handleChangeWrapper");
  function isSubscribed() {
    return selfSubscribed;
  }
  __name(isSubscribed, "isSubscribed");
  function trySubscribe() {
    subscriptionsAmount++;
    if (!unsubscribe) {
      unsubscribe = parentSub ? parentSub.addNestedSub(handleChangeWrapper) : store.subscribe(handleChangeWrapper);
      listeners = createListenerCollection();
    }
  }
  __name(trySubscribe, "trySubscribe");
  function tryUnsubscribe() {
    subscriptionsAmount--;
    if (unsubscribe && subscriptionsAmount === 0) {
      unsubscribe();
      unsubscribe = void 0;
      listeners.clear();
      listeners = nullListeners;
    }
  }
  __name(tryUnsubscribe, "tryUnsubscribe");
  function trySubscribeSelf() {
    if (!selfSubscribed) {
      selfSubscribed = true;
      trySubscribe();
    }
  }
  __name(trySubscribeSelf, "trySubscribeSelf");
  function tryUnsubscribeSelf() {
    if (selfSubscribed) {
      selfSubscribed = false;
      tryUnsubscribe();
    }
  }
  __name(tryUnsubscribeSelf, "tryUnsubscribeSelf");
  const subscription = {
    addNestedSub,
    notifyNestedSubs,
    handleChangeWrapper,
    isSubscribed,
    trySubscribe: trySubscribeSelf,
    tryUnsubscribe: tryUnsubscribeSelf,
    getListeners: /* @__PURE__ */ __name(() => listeners, "getListeners")
  };
  return subscription;
}
__name(createSubscription, "createSubscription");
var canUseDOM = /* @__PURE__ */ __name(() => !!(typeof window !== "undefined" && typeof window.document !== "undefined" && typeof window.document.createElement !== "undefined"), "canUseDOM");
var isDOM = /* @__PURE__ */ canUseDOM();
var isRunningInReactNative = /* @__PURE__ */ __name(() => typeof navigator !== "undefined" && navigator.product === "ReactNative", "isRunningInReactNative");
var isReactNative = /* @__PURE__ */ isRunningInReactNative();
var getUseIsomorphicLayoutEffect = /* @__PURE__ */ __name(() => isDOM || isReactNative ? reactExports.useLayoutEffect : reactExports.useEffect, "getUseIsomorphicLayoutEffect");
var useIsomorphicLayoutEffect$1 = /* @__PURE__ */ getUseIsomorphicLayoutEffect();
function is(x, y) {
  if (x === y) {
    return x !== 0 || y !== 0 || 1 / x === 1 / y;
  } else {
    return x !== x && y !== y;
  }
}
__name(is, "is");
function shallowEqual(objA, objB) {
  if (is(objA, objB)) return true;
  if (typeof objA !== "object" || objA === null || typeof objB !== "object" || objB === null) {
    return false;
  }
  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);
  if (keysA.length !== keysB.length) return false;
  for (let i = 0; i < keysA.length; i++) {
    if (!Object.prototype.hasOwnProperty.call(objB, keysA[i]) || !is(objA[keysA[i]], objB[keysA[i]])) {
      return false;
    }
  }
  return true;
}
__name(shallowEqual, "shallowEqual");
var REACT_STATICS = {
  childContextTypes: true,
  contextType: true,
  contextTypes: true,
  defaultProps: true,
  displayName: true,
  getDefaultProps: true,
  getDerivedStateFromError: true,
  getDerivedStateFromProps: true,
  mixins: true,
  propTypes: true,
  type: true
};
var KNOWN_STATICS = {
  name: true,
  length: true,
  prototype: true,
  caller: true,
  callee: true,
  arguments: true,
  arity: true
};
var FORWARD_REF_STATICS = {
  $$typeof: true,
  render: true,
  defaultProps: true,
  displayName: true,
  propTypes: true
};
var MEMO_STATICS = {
  $$typeof: true,
  compare: true,
  defaultProps: true,
  displayName: true,
  propTypes: true,
  type: true
};
var TYPE_STATICS = {
  [ForwardRef]: FORWARD_REF_STATICS,
  [Memo]: MEMO_STATICS
};
function getStatics(component) {
  if (isMemo(component)) {
    return MEMO_STATICS;
  }
  return TYPE_STATICS[component["$$typeof"]] || REACT_STATICS;
}
__name(getStatics, "getStatics");
var defineProperty = Object.defineProperty;
var getOwnPropertyNames = Object.getOwnPropertyNames;
var getOwnPropertySymbols = Object.getOwnPropertySymbols;
var getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
var getPrototypeOf = Object.getPrototypeOf;
var objectPrototype = Object.prototype;
function hoistNonReactStatics(targetComponent, sourceComponent) {
  if (typeof sourceComponent !== "string") {
    if (objectPrototype) {
      const inheritedComponent = getPrototypeOf(sourceComponent);
      if (inheritedComponent && inheritedComponent !== objectPrototype) {
        hoistNonReactStatics(targetComponent, inheritedComponent);
      }
    }
    let keys = getOwnPropertyNames(sourceComponent);
    if (getOwnPropertySymbols) {
      keys = keys.concat(getOwnPropertySymbols(sourceComponent));
    }
    const targetStatics = getStatics(targetComponent);
    const sourceStatics = getStatics(sourceComponent);
    for (let i = 0; i < keys.length; ++i) {
      const key = keys[i];
      if (!KNOWN_STATICS[key] && !(sourceStatics && sourceStatics[key]) && !(targetStatics && targetStatics[key])) {
        const descriptor = getOwnPropertyDescriptor(sourceComponent, key);
        try {
          defineProperty(targetComponent, key, descriptor);
        } catch (e) {
        }
      }
    }
  }
  return targetComponent;
}
__name(hoistNonReactStatics, "hoistNonReactStatics");
var ContextKey = /* @__PURE__ */ Symbol.for(`react-redux-context`);
var gT = typeof globalThis !== "undefined" ? globalThis : (
  /* fall back to a per-module scope (pre-8.1 behaviour) if `globalThis` is not available */
  {}
);
function getContext() {
  if (!reactExports.createContext) return {};
  const contextMap = gT[ContextKey] ??= /* @__PURE__ */ new Map();
  let realContext = contextMap.get(reactExports.createContext);
  if (!realContext) {
    realContext = reactExports.createContext(
      null
    );
    contextMap.set(reactExports.createContext, realContext);
  }
  return realContext;
}
__name(getContext, "getContext");
var ReactReduxContext = /* @__PURE__ */ getContext();
var NO_SUBSCRIPTION_ARRAY = [null, null];
function useIsomorphicLayoutEffectWithArgs(effectFunc, effectArgs, dependencies) {
  useIsomorphicLayoutEffect$1(() => effectFunc(...effectArgs), dependencies);
}
__name(useIsomorphicLayoutEffectWithArgs, "useIsomorphicLayoutEffectWithArgs");
function captureWrapperProps(lastWrapperProps, lastChildProps, renderIsScheduled, wrapperProps, childPropsFromStoreUpdate, notifyNestedSubs) {
  lastWrapperProps.current = wrapperProps;
  renderIsScheduled.current = false;
  if (childPropsFromStoreUpdate.current) {
    childPropsFromStoreUpdate.current = null;
    notifyNestedSubs();
  }
}
__name(captureWrapperProps, "captureWrapperProps");
function subscribeUpdates(shouldHandleStateChanges, store, subscription, childPropsSelector, lastWrapperProps, lastChildProps, renderIsScheduled, isMounted, childPropsFromStoreUpdate, notifyNestedSubs, additionalSubscribeListener) {
  if (!shouldHandleStateChanges) return () => {
  };
  let didUnsubscribe = false;
  let lastThrownError = null;
  const checkForUpdates = /* @__PURE__ */ __name(() => {
    if (didUnsubscribe || !isMounted.current) {
      return;
    }
    const latestStoreState = store.getState();
    let newChildProps, error;
    try {
      newChildProps = childPropsSelector(
        latestStoreState,
        lastWrapperProps.current
      );
    } catch (e) {
      error = e;
      lastThrownError = e;
    }
    if (!error) {
      lastThrownError = null;
    }
    if (newChildProps === lastChildProps.current) {
      if (!renderIsScheduled.current) {
        notifyNestedSubs();
      }
    } else {
      lastChildProps.current = newChildProps;
      childPropsFromStoreUpdate.current = newChildProps;
      renderIsScheduled.current = true;
      additionalSubscribeListener();
    }
  }, "checkForUpdates");
  subscription.onStateChange = checkForUpdates;
  subscription.trySubscribe();
  checkForUpdates();
  const unsubscribeWrapper = /* @__PURE__ */ __name(() => {
    didUnsubscribe = true;
    subscription.tryUnsubscribe();
    subscription.onStateChange = null;
    if (lastThrownError) {
      throw lastThrownError;
    }
  }, "unsubscribeWrapper");
  return unsubscribeWrapper;
}
__name(subscribeUpdates, "subscribeUpdates");
function strictEqual(a, b) {
  return a === b;
}
__name(strictEqual, "strictEqual");
function connect(mapStateToProps, mapDispatchToProps2, mergeProps, {
  // The `pure` option has been removed, so TS doesn't like us destructuring this to check its existence.
  // @ts-ignore
  pure,
  areStatesEqual = strictEqual,
  areOwnPropsEqual = shallowEqual,
  areStatePropsEqual = shallowEqual,
  areMergedPropsEqual = shallowEqual,
  // use React's forwardRef to expose a ref of the wrapped component
  forwardRef = false,
  // the context consumer to use
  context = ReactReduxContext
} = {}) {
  const Context = context;
  const initMapStateToProps = mapStateToPropsFactory(mapStateToProps);
  const initMapDispatchToProps = mapDispatchToPropsFactory(mapDispatchToProps2);
  const initMergeProps = mergePropsFactory(mergeProps);
  const shouldHandleStateChanges = Boolean(mapStateToProps);
  const wrapWithConnect = /* @__PURE__ */ __name((WrappedComponent) => {
    const wrappedComponentName = WrappedComponent.displayName || WrappedComponent.name || "Component";
    const displayName = `Connect(${wrappedComponentName})`;
    const selectorFactoryOptions = {
      shouldHandleStateChanges,
      displayName,
      wrappedComponentName,
      WrappedComponent,
      // @ts-ignore
      initMapStateToProps,
      initMapDispatchToProps,
      initMergeProps,
      areStatesEqual,
      areStatePropsEqual,
      areOwnPropsEqual,
      areMergedPropsEqual
    };
    function ConnectFunction(props) {
      const [propsContext, reactReduxForwardedRef, wrapperProps] = reactExports.useMemo(() => {
        const { reactReduxForwardedRef: reactReduxForwardedRef2, ...wrapperProps2 } = props;
        return [props.context, reactReduxForwardedRef2, wrapperProps2];
      }, [props]);
      const ContextToUse = reactExports.useMemo(() => {
        let ResultContext = Context;
        if (propsContext?.Consumer) ;
        return ResultContext;
      }, [propsContext, Context]);
      const contextValue = reactExports.useContext(ContextToUse);
      const didStoreComeFromProps = Boolean(props.store) && Boolean(props.store.getState) && Boolean(props.store.dispatch);
      const didStoreComeFromContext = Boolean(contextValue) && Boolean(contextValue.store);
      const store = didStoreComeFromProps ? props.store : contextValue.store;
      const getServerState = didStoreComeFromContext ? contextValue.getServerState : store.getState;
      const childPropsSelector = reactExports.useMemo(() => {
        return finalPropsSelectorFactory(store.dispatch, selectorFactoryOptions);
      }, [store]);
      const [subscription, notifyNestedSubs] = reactExports.useMemo(() => {
        if (!shouldHandleStateChanges) return NO_SUBSCRIPTION_ARRAY;
        const subscription2 = createSubscription(
          store,
          didStoreComeFromProps ? void 0 : contextValue.subscription
        );
        const notifyNestedSubs2 = subscription2.notifyNestedSubs.bind(subscription2);
        return [subscription2, notifyNestedSubs2];
      }, [store, didStoreComeFromProps, contextValue]);
      const overriddenContextValue = reactExports.useMemo(() => {
        if (didStoreComeFromProps) {
          return contextValue;
        }
        return {
          ...contextValue,
          subscription
        };
      }, [didStoreComeFromProps, contextValue, subscription]);
      const lastChildProps = reactExports.useRef(void 0);
      const lastWrapperProps = reactExports.useRef(wrapperProps);
      const childPropsFromStoreUpdate = reactExports.useRef(void 0);
      const renderIsScheduled = reactExports.useRef(false);
      const isMounted = reactExports.useRef(false);
      const latestSubscriptionCallbackError = reactExports.useRef(
        void 0
      );
      useIsomorphicLayoutEffect$1(() => {
        isMounted.current = true;
        return () => {
          isMounted.current = false;
        };
      }, []);
      const actualChildPropsSelector = reactExports.useMemo(() => {
        const selector = /* @__PURE__ */ __name(() => {
          if (childPropsFromStoreUpdate.current && wrapperProps === lastWrapperProps.current) {
            return childPropsFromStoreUpdate.current;
          }
          return childPropsSelector(store.getState(), wrapperProps);
        }, "selector");
        return selector;
      }, [store, wrapperProps]);
      const subscribeForReact = reactExports.useMemo(() => {
        const subscribe = /* @__PURE__ */ __name((reactListener) => {
          if (!subscription) {
            return () => {
            };
          }
          return subscribeUpdates(
            shouldHandleStateChanges,
            store,
            subscription,
            // @ts-ignore
            childPropsSelector,
            lastWrapperProps,
            lastChildProps,
            renderIsScheduled,
            isMounted,
            childPropsFromStoreUpdate,
            notifyNestedSubs,
            reactListener
          );
        }, "subscribe");
        return subscribe;
      }, [subscription]);
      useIsomorphicLayoutEffectWithArgs(captureWrapperProps, [
        lastWrapperProps,
        lastChildProps,
        renderIsScheduled,
        wrapperProps,
        childPropsFromStoreUpdate,
        notifyNestedSubs
      ]);
      let actualChildProps;
      try {
        actualChildProps = reactExports.useSyncExternalStore(
          // TODO We're passing through a big wrapper that does a bunch of extra side effects besides subscribing
          subscribeForReact,
          // TODO This is incredibly hacky. We've already processed the store update and calculated new child props,
          // TODO and we're just passing that through so it triggers a re-render for us rather than relying on `uSES`.
          actualChildPropsSelector,
          getServerState ? () => childPropsSelector(getServerState(), wrapperProps) : actualChildPropsSelector
        );
      } catch (err) {
        if (latestSubscriptionCallbackError.current) {
          err.message += `
The error may be correlated with this previous error:
${latestSubscriptionCallbackError.current.stack}

`;
        }
        throw err;
      }
      useIsomorphicLayoutEffect$1(() => {
        latestSubscriptionCallbackError.current = void 0;
        childPropsFromStoreUpdate.current = void 0;
        lastChildProps.current = actualChildProps;
      });
      const renderedWrappedComponent = reactExports.useMemo(() => {
        return (
          // @ts-ignore
          /* @__PURE__ */ reactExports.createElement(
            WrappedComponent,
            {
              ...actualChildProps,
              ref: reactReduxForwardedRef
            }
          )
        );
      }, [reactReduxForwardedRef, WrappedComponent, actualChildProps]);
      const renderedChild = reactExports.useMemo(() => {
        if (shouldHandleStateChanges) {
          return /* @__PURE__ */ reactExports.createElement(ContextToUse.Provider, { value: overriddenContextValue }, renderedWrappedComponent);
        }
        return renderedWrappedComponent;
      }, [ContextToUse, renderedWrappedComponent, overriddenContextValue]);
      return renderedChild;
    }
    __name(ConnectFunction, "ConnectFunction");
    const _Connect = reactExports.memo(ConnectFunction);
    const Connect = _Connect;
    Connect.WrappedComponent = WrappedComponent;
    Connect.displayName = ConnectFunction.displayName = displayName;
    if (forwardRef) {
      const _forwarded = reactExports.forwardRef(
        /* @__PURE__ */ __name(function forwardConnectRef(props, ref) {
          return /* @__PURE__ */ reactExports.createElement(Connect, { ...props, reactReduxForwardedRef: ref });
        }, "forwardConnectRef")
      );
      const forwarded = _forwarded;
      forwarded.displayName = displayName;
      forwarded.WrappedComponent = WrappedComponent;
      return /* @__PURE__ */ hoistNonReactStatics(forwarded, WrappedComponent);
    }
    return /* @__PURE__ */ hoistNonReactStatics(Connect, WrappedComponent);
  }, "wrapWithConnect");
  return wrapWithConnect;
}
__name(connect, "connect");
var connect_default = connect;
function Provider(providerProps) {
  const { children, context, serverState, store } = providerProps;
  const contextValue = reactExports.useMemo(() => {
    const subscription = createSubscription(store);
    const baseContextValue = {
      store,
      subscription,
      getServerState: serverState ? () => serverState : void 0
    };
    {
      return baseContextValue;
    }
  }, [store, serverState]);
  const previousState = reactExports.useMemo(() => store.getState(), [store]);
  useIsomorphicLayoutEffect$1(() => {
    const { subscription } = contextValue;
    subscription.onStateChange = subscription.notifyNestedSubs;
    subscription.trySubscribe();
    if (previousState !== store.getState()) {
      subscription.notifyNestedSubs();
    }
    return () => {
      subscription.tryUnsubscribe();
      subscription.onStateChange = void 0;
    };
  }, [contextValue, previousState]);
  const Context = context || ReactReduxContext;
  return /* @__PURE__ */ reactExports.createElement(Context.Provider, { value: contextValue }, children);
}
__name(Provider, "Provider");
var Provider_default = Provider;
var prefix$2 = "Invariant failed";
function invariant$1(condition, message) {
  {
    throw new Error(prefix$2);
  }
}
__name(invariant$1, "invariant$1");
var getRect = /* @__PURE__ */ __name(function getRect2(_ref) {
  var top = _ref.top, right = _ref.right, bottom = _ref.bottom, left = _ref.left;
  var width = right - left;
  var height = bottom - top;
  var rect = {
    top,
    right,
    bottom,
    left,
    width,
    height,
    x: left,
    y: top,
    center: {
      x: (right + left) / 2,
      y: (bottom + top) / 2
    }
  };
  return rect;
}, "getRect2");
var expand = /* @__PURE__ */ __name(function expand2(target, expandBy) {
  return {
    top: target.top - expandBy.top,
    left: target.left - expandBy.left,
    bottom: target.bottom + expandBy.bottom,
    right: target.right + expandBy.right
  };
}, "expand2");
var shrink = /* @__PURE__ */ __name(function shrink2(target, shrinkBy) {
  return {
    top: target.top + shrinkBy.top,
    left: target.left + shrinkBy.left,
    bottom: target.bottom - shrinkBy.bottom,
    right: target.right - shrinkBy.right
  };
}, "shrink2");
var shift = /* @__PURE__ */ __name(function shift2(target, shiftBy) {
  return {
    top: target.top + shiftBy.y,
    left: target.left + shiftBy.x,
    bottom: target.bottom + shiftBy.y,
    right: target.right + shiftBy.x
  };
}, "shift2");
var noSpacing$1 = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0
};
var createBox = /* @__PURE__ */ __name(function createBox2(_ref2) {
  var borderBox = _ref2.borderBox, _ref2$margin = _ref2.margin, margin = _ref2$margin === void 0 ? noSpacing$1 : _ref2$margin, _ref2$border = _ref2.border, border = _ref2$border === void 0 ? noSpacing$1 : _ref2$border, _ref2$padding = _ref2.padding, padding = _ref2$padding === void 0 ? noSpacing$1 : _ref2$padding;
  var marginBox = getRect(expand(borderBox, margin));
  var paddingBox = getRect(shrink(borderBox, border));
  var contentBox = getRect(shrink(paddingBox, padding));
  return {
    marginBox,
    borderBox: getRect(borderBox),
    paddingBox,
    contentBox,
    margin,
    border,
    padding
  };
}, "createBox2");
var parse = /* @__PURE__ */ __name(function parse2(raw) {
  var value = raw.slice(0, -2);
  var suffix = raw.slice(-2);
  if (suffix !== "px") {
    return 0;
  }
  var result = Number(value);
  !!isNaN(result) ? invariant$1() : void 0;
  return result;
}, "parse2");
var getWindowScroll$1 = /* @__PURE__ */ __name(function getWindowScroll2() {
  return {
    x: window.pageXOffset,
    y: window.pageYOffset
  };
}, "getWindowScroll2");
var offset = /* @__PURE__ */ __name(function offset2(original, change) {
  var borderBox = original.borderBox, border = original.border, margin = original.margin, padding = original.padding;
  var shifted = shift(borderBox, change);
  return createBox({
    borderBox: shifted,
    border,
    margin,
    padding
  });
}, "offset2");
var withScroll = /* @__PURE__ */ __name(function withScroll2(original, scroll2) {
  if (scroll2 === void 0) {
    scroll2 = getWindowScroll$1();
  }
  return offset(original, scroll2);
}, "withScroll2");
var calculateBox = /* @__PURE__ */ __name(function calculateBox2(borderBox, styles) {
  var margin = {
    top: parse(styles.marginTop),
    right: parse(styles.marginRight),
    bottom: parse(styles.marginBottom),
    left: parse(styles.marginLeft)
  };
  var padding = {
    top: parse(styles.paddingTop),
    right: parse(styles.paddingRight),
    bottom: parse(styles.paddingBottom),
    left: parse(styles.paddingLeft)
  };
  var border = {
    top: parse(styles.borderTopWidth),
    right: parse(styles.borderRightWidth),
    bottom: parse(styles.borderBottomWidth),
    left: parse(styles.borderLeftWidth)
  };
  return createBox({
    borderBox,
    margin,
    padding,
    border
  });
}, "calculateBox2");
var getBox = /* @__PURE__ */ __name(function getBox2(el) {
  var borderBox = el.getBoundingClientRect();
  var styles = window.getComputedStyle(el);
  return calculateBox(borderBox, styles);
}, "getBox2");
var rafSchd = /* @__PURE__ */ __name(function rafSchd2(fn) {
  var lastArgs = [];
  var frameId = null;
  var wrapperFn = /* @__PURE__ */ __name(function wrapperFn2() {
    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }
    lastArgs = args;
    if (frameId) {
      return;
    }
    frameId = requestAnimationFrame(function() {
      frameId = null;
      fn.apply(void 0, lastArgs);
    });
  }, "wrapperFn");
  wrapperFn.cancel = function() {
    if (!frameId) {
      return;
    }
    cancelAnimationFrame(frameId);
    frameId = null;
  };
  return wrapperFn;
}, "rafSchd");
function _extends() {
  return _extends = Object.assign ? Object.assign.bind() : function(n) {
    for (var e = 1; e < arguments.length; e++) {
      var t = arguments[e];
      for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]);
    }
    return n;
  }, _extends.apply(null, arguments);
}
__name(_extends, "_extends");
function log(type, message) {
  {
    return;
  }
}
__name(log, "log");
log.bind(null, "warn");
log.bind(null, "error");
function noop$2() {
}
__name(noop$2, "noop$2");
function getOptions(shared2, fromBinding) {
  return {
    ...shared2,
    ...fromBinding
  };
}
__name(getOptions, "getOptions");
function bindEvents(el, bindings, sharedOptions) {
  const unbindings = bindings.map((binding) => {
    const options = getOptions(sharedOptions, binding.options);
    el.addEventListener(binding.eventName, binding.fn, options);
    return /* @__PURE__ */ __name(function unbind() {
      el.removeEventListener(binding.eventName, binding.fn, options);
    }, "unbind");
  });
  return /* @__PURE__ */ __name(function unbindAll() {
    unbindings.forEach((unbind) => {
      unbind();
    });
  }, "unbindAll");
}
__name(bindEvents, "bindEvents");
const prefix$1 = "Invariant failed";
const _RbdInvariant = class _RbdInvariant extends Error {
};
__name(_RbdInvariant, "RbdInvariant");
let RbdInvariant = _RbdInvariant;
RbdInvariant.prototype.toString = /* @__PURE__ */ __name(function toString() {
  return this.message;
}, "toString");
function invariant(condition, message) {
  {
    throw new RbdInvariant(prefix$1);
  }
}
__name(invariant, "invariant");
const _ErrorBoundary = class _ErrorBoundary extends React.Component {
  constructor(...args) {
    super(...args);
    this.callbacks = null;
    this.unbind = noop$2;
    this.onWindowError = (event) => {
      const callbacks = this.getCallbacks();
      if (callbacks.isDragging()) {
        callbacks.tryAbort();
      }
      const err = event.error;
      if (err instanceof RbdInvariant) {
        event.preventDefault();
      }
    };
    this.getCallbacks = () => {
      if (!this.callbacks) {
        throw new Error("Unable to find AppCallbacks in <ErrorBoundary/>");
      }
      return this.callbacks;
    };
    this.setCallbacks = (callbacks) => {
      this.callbacks = callbacks;
    };
  }
  componentDidMount() {
    this.unbind = bindEvents(window, [{
      eventName: "error",
      fn: this.onWindowError
    }]);
  }
  componentDidCatch(err) {
    if (err instanceof RbdInvariant) {
      this.setState({});
      return;
    }
    throw err;
  }
  componentWillUnmount() {
    this.unbind();
  }
  render() {
    return this.props.children(this.setCallbacks);
  }
};
__name(_ErrorBoundary, "ErrorBoundary");
let ErrorBoundary = _ErrorBoundary;
const dragHandleUsageInstructions = `
  Press space bar to start a drag.
  When dragging you can use the arrow keys to move the item around and escape to cancel.
  Some screen readers may require you to be in focus mode or to use your pass through key
`;
const position = /* @__PURE__ */ __name((index) => index + 1, "position");
const onDragStart = /* @__PURE__ */ __name((start2) => `
  You have lifted an item in position ${position(start2.source.index)}
`, "onDragStart");
const withLocation = /* @__PURE__ */ __name((source, destination) => {
  const isInHomeList = source.droppableId === destination.droppableId;
  const startPosition = position(source.index);
  const endPosition = position(destination.index);
  if (isInHomeList) {
    return `
      You have moved the item from position ${startPosition}
      to position ${endPosition}
    `;
  }
  return `
    You have moved the item from position ${startPosition}
    in list ${source.droppableId}
    to list ${destination.droppableId}
    in position ${endPosition}
  `;
}, "withLocation");
const withCombine = /* @__PURE__ */ __name((id, source, combine2) => {
  const inHomeList = source.droppableId === combine2.droppableId;
  if (inHomeList) {
    return `
      The item ${id}
      has been combined with ${combine2.draggableId}`;
  }
  return `
      The item ${id}
      in list ${source.droppableId}
      has been combined with ${combine2.draggableId}
      in list ${combine2.droppableId}
    `;
}, "withCombine");
const onDragUpdate = /* @__PURE__ */ __name((update2) => {
  const location = update2.destination;
  if (location) {
    return withLocation(update2.source, location);
  }
  const combine2 = update2.combine;
  if (combine2) {
    return withCombine(update2.draggableId, update2.source, combine2);
  }
  return "You are over an area that cannot be dropped on";
}, "onDragUpdate");
const returnedToStart = /* @__PURE__ */ __name((source) => `
  The item has returned to its starting position
  of ${position(source.index)}
`, "returnedToStart");
const onDragEnd = /* @__PURE__ */ __name((result) => {
  if (result.reason === "CANCEL") {
    return `
      Movement cancelled.
      ${returnedToStart(result.source)}
    `;
  }
  const location = result.destination;
  const combine2 = result.combine;
  if (location) {
    return `
      You have dropped the item.
      ${withLocation(result.source, location)}
    `;
  }
  if (combine2) {
    return `
      You have dropped the item.
      ${withCombine(result.draggableId, result.source, combine2)}
    `;
  }
  return `
    The item has been dropped while not over a drop area.
    ${returnedToStart(result.source)}
  `;
}, "onDragEnd");
const preset = {
  dragHandleUsageInstructions,
  onDragStart,
  onDragUpdate,
  onDragEnd
};
function isEqual$2(first, second) {
  if (first === second) {
    return true;
  }
  if (Number.isNaN(first) && Number.isNaN(second)) {
    return true;
  }
  return false;
}
__name(isEqual$2, "isEqual$2");
function areInputsEqual(newInputs, lastInputs) {
  if (newInputs.length !== lastInputs.length) {
    return false;
  }
  for (let i = 0; i < newInputs.length; i++) {
    if (!isEqual$2(newInputs[i], lastInputs[i])) {
      return false;
    }
  }
  return true;
}
__name(areInputsEqual, "areInputsEqual");
function useMemo(getResult, inputs) {
  const initial = reactExports.useState(() => ({
    inputs,
    result: getResult()
  }))[0];
  const isFirstRun = reactExports.useRef(true);
  const committed = reactExports.useRef(initial);
  const useCache = isFirstRun.current || Boolean(inputs && committed.current.inputs && areInputsEqual(inputs, committed.current.inputs));
  const cache = useCache ? committed.current : {
    inputs,
    result: getResult()
  };
  reactExports.useEffect(() => {
    isFirstRun.current = false;
    committed.current = cache;
  }, [cache]);
  return cache.result;
}
__name(useMemo, "useMemo");
function useCallback(callback, inputs) {
  return useMemo(() => callback, inputs);
}
__name(useCallback, "useCallback");
const origin = {
  x: 0,
  y: 0
};
const add = /* @__PURE__ */ __name((point1, point2) => ({
  x: point1.x + point2.x,
  y: point1.y + point2.y
}), "add");
const subtract = /* @__PURE__ */ __name((point1, point2) => ({
  x: point1.x - point2.x,
  y: point1.y - point2.y
}), "subtract");
const isEqual$1 = /* @__PURE__ */ __name((point1, point2) => point1.x === point2.x && point1.y === point2.y, "isEqual$1");
const negate = /* @__PURE__ */ __name((point) => ({
  x: point.x !== 0 ? -point.x : 0,
  y: point.y !== 0 ? -point.y : 0
}), "negate");
const patch = /* @__PURE__ */ __name((line, value, otherValue = 0) => {
  if (line === "x") {
    return {
      x: value,
      y: otherValue
    };
  }
  return {
    x: otherValue,
    y: value
  };
}, "patch");
const distance = /* @__PURE__ */ __name((point1, point2) => Math.sqrt((point2.x - point1.x) ** 2 + (point2.y - point1.y) ** 2), "distance");
const closest$1 = /* @__PURE__ */ __name((target, points) => Math.min(...points.map((point) => distance(target, point))), "closest$1");
const apply = /* @__PURE__ */ __name((fn) => (point) => ({
  x: fn(point.x),
  y: fn(point.y)
}), "apply");
var executeClip = /* @__PURE__ */ __name((frame, subject) => {
  const result = getRect({
    top: Math.max(subject.top, frame.top),
    right: Math.min(subject.right, frame.right),
    bottom: Math.min(subject.bottom, frame.bottom),
    left: Math.max(subject.left, frame.left)
  });
  if (result.width <= 0 || result.height <= 0) {
    return null;
  }
  return result;
}, "executeClip");
const offsetByPosition = /* @__PURE__ */ __name((spacing, point) => ({
  top: spacing.top + point.y,
  left: spacing.left + point.x,
  bottom: spacing.bottom + point.y,
  right: spacing.right + point.x
}), "offsetByPosition");
const getCorners = /* @__PURE__ */ __name((spacing) => [{
  x: spacing.left,
  y: spacing.top
}, {
  x: spacing.right,
  y: spacing.top
}, {
  x: spacing.left,
  y: spacing.bottom
}, {
  x: spacing.right,
  y: spacing.bottom
}], "getCorners");
const noSpacing = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0
};
const scroll$1 = /* @__PURE__ */ __name((target, frame) => {
  if (!frame) {
    return target;
  }
  return offsetByPosition(target, frame.scroll.diff.displacement);
}, "scroll$1");
const increase = /* @__PURE__ */ __name((target, axis, withPlaceholder) => {
  if (withPlaceholder && withPlaceholder.increasedBy) {
    return {
      ...target,
      [axis.end]: target[axis.end] + withPlaceholder.increasedBy[axis.line]
    };
  }
  return target;
}, "increase");
const clip = /* @__PURE__ */ __name((target, frame) => {
  if (frame && frame.shouldClipSubject) {
    return executeClip(frame.pageMarginBox, target);
  }
  return getRect(target);
}, "clip");
var getSubject = /* @__PURE__ */ __name(({
  page,
  withPlaceholder,
  axis,
  frame
}) => {
  const scrolled = scroll$1(page.marginBox, frame);
  const increased = increase(scrolled, axis, withPlaceholder);
  const clipped = clip(increased, frame);
  return {
    page,
    withPlaceholder,
    active: clipped
  };
}, "getSubject");
var scrollDroppable = /* @__PURE__ */ __name((droppable2, newScroll) => {
  !droppable2.frame ? invariant() : void 0;
  const scrollable = droppable2.frame;
  const scrollDiff = subtract(newScroll, scrollable.scroll.initial);
  const scrollDisplacement = negate(scrollDiff);
  const frame = {
    ...scrollable,
    scroll: {
      initial: scrollable.scroll.initial,
      current: newScroll,
      diff: {
        value: scrollDiff,
        displacement: scrollDisplacement
      },
      max: scrollable.scroll.max
    }
  };
  const subject = getSubject({
    page: droppable2.subject.page,
    withPlaceholder: droppable2.subject.withPlaceholder,
    axis: droppable2.axis,
    frame
  });
  const result = {
    ...droppable2,
    frame,
    subject
  };
  return result;
}, "scrollDroppable");
function memoizeOne(resultFn, isEqual2 = areInputsEqual) {
  let cache = null;
  function memoized(...newArgs) {
    if (cache && cache.lastThis === this && isEqual2(newArgs, cache.lastArgs)) {
      return cache.lastResult;
    }
    const lastResult = resultFn.apply(this, newArgs);
    cache = {
      lastResult,
      lastArgs: newArgs,
      lastThis: this
    };
    return lastResult;
  }
  __name(memoized, "memoized");
  memoized.clear = /* @__PURE__ */ __name(function clear() {
    cache = null;
  }, "clear");
  return memoized;
}
__name(memoizeOne, "memoizeOne");
const toDroppableMap = memoizeOne((droppables) => droppables.reduce((previous, current) => {
  previous[current.descriptor.id] = current;
  return previous;
}, {}));
const toDraggableMap = memoizeOne((draggables) => draggables.reduce((previous, current) => {
  previous[current.descriptor.id] = current;
  return previous;
}, {}));
const toDroppableList = memoizeOne((droppables) => Object.values(droppables));
const toDraggableList = memoizeOne((draggables) => Object.values(draggables));
var getDraggablesInsideDroppable = memoizeOne((droppableId, draggables) => {
  const result = toDraggableList(draggables).filter((draggable2) => droppableId === draggable2.descriptor.droppableId).sort((a, b) => a.descriptor.index - b.descriptor.index);
  return result;
});
function tryGetDestination(impact) {
  if (impact.at && impact.at.type === "REORDER") {
    return impact.at.destination;
  }
  return null;
}
__name(tryGetDestination, "tryGetDestination");
function tryGetCombine(impact) {
  if (impact.at && impact.at.type === "COMBINE") {
    return impact.at.combine;
  }
  return null;
}
__name(tryGetCombine, "tryGetCombine");
var removeDraggableFromList = memoizeOne((remove, list) => list.filter((item) => item.descriptor.id !== remove.descriptor.id));
var moveToNextCombine = /* @__PURE__ */ __name(({
  isMovingForward,
  draggable: draggable2,
  destination,
  insideDestination,
  previousImpact
}) => {
  if (!destination.isCombineEnabled) {
    return null;
  }
  const location = tryGetDestination(previousImpact);
  if (!location) {
    return null;
  }
  function getImpact(target) {
    const at = {
      type: "COMBINE",
      combine: {
        draggableId: target,
        droppableId: destination.descriptor.id
      }
    };
    return {
      ...previousImpact,
      at
    };
  }
  __name(getImpact, "getImpact");
  const all = previousImpact.displaced.all;
  const closestId = all.length ? all[0] : null;
  if (isMovingForward) {
    return closestId ? getImpact(closestId) : null;
  }
  const withoutDraggable = removeDraggableFromList(draggable2, insideDestination);
  if (!closestId) {
    if (!withoutDraggable.length) {
      return null;
    }
    const last = withoutDraggable[withoutDraggable.length - 1];
    return getImpact(last.descriptor.id);
  }
  const indexOfClosest = withoutDraggable.findIndex((d) => d.descriptor.id === closestId);
  !(indexOfClosest !== -1) ? invariant() : void 0;
  const proposedIndex = indexOfClosest - 1;
  if (proposedIndex < 0) {
    return null;
  }
  const before = withoutDraggable[proposedIndex];
  return getImpact(before.descriptor.id);
}, "moveToNextCombine");
var isHomeOf = /* @__PURE__ */ __name((draggable2, destination) => draggable2.descriptor.droppableId === destination.descriptor.id, "isHomeOf");
const noDisplacedBy = {
  point: origin,
  value: 0
};
const emptyGroups = {
  invisible: {},
  visible: {},
  all: []
};
const noImpact = {
  displaced: emptyGroups,
  displacedBy: noDisplacedBy,
  at: null
};
var isWithin = /* @__PURE__ */ __name((lowerBound, upperBound) => (value) => lowerBound <= value && value <= upperBound, "isWithin");
var isPartiallyVisibleThroughFrame = /* @__PURE__ */ __name((frame) => {
  const isWithinVertical = isWithin(frame.top, frame.bottom);
  const isWithinHorizontal = isWithin(frame.left, frame.right);
  return (subject) => {
    const isContained = isWithinVertical(subject.top) && isWithinVertical(subject.bottom) && isWithinHorizontal(subject.left) && isWithinHorizontal(subject.right);
    if (isContained) {
      return true;
    }
    const isPartiallyVisibleVertically = isWithinVertical(subject.top) || isWithinVertical(subject.bottom);
    const isPartiallyVisibleHorizontally = isWithinHorizontal(subject.left) || isWithinHorizontal(subject.right);
    const isPartiallyContained = isPartiallyVisibleVertically && isPartiallyVisibleHorizontally;
    if (isPartiallyContained) {
      return true;
    }
    const isBiggerVertically = subject.top < frame.top && subject.bottom > frame.bottom;
    const isBiggerHorizontally = subject.left < frame.left && subject.right > frame.right;
    const isTargetBiggerThanFrame = isBiggerVertically && isBiggerHorizontally;
    if (isTargetBiggerThanFrame) {
      return true;
    }
    const isTargetBiggerOnOneAxis = isBiggerVertically && isPartiallyVisibleHorizontally || isBiggerHorizontally && isPartiallyVisibleVertically;
    return isTargetBiggerOnOneAxis;
  };
}, "isPartiallyVisibleThroughFrame");
var isTotallyVisibleThroughFrame = /* @__PURE__ */ __name((frame) => {
  const isWithinVertical = isWithin(frame.top, frame.bottom);
  const isWithinHorizontal = isWithin(frame.left, frame.right);
  return (subject) => {
    const isContained = isWithinVertical(subject.top) && isWithinVertical(subject.bottom) && isWithinHorizontal(subject.left) && isWithinHorizontal(subject.right);
    return isContained;
  };
}, "isTotallyVisibleThroughFrame");
const vertical = {
  direction: "vertical",
  line: "y",
  crossAxisLine: "x",
  start: "top",
  end: "bottom",
  size: "height",
  crossAxisStart: "left",
  crossAxisEnd: "right",
  crossAxisSize: "width"
};
const horizontal = {
  direction: "horizontal",
  line: "x",
  crossAxisLine: "y",
  start: "left",
  end: "right",
  size: "width",
  crossAxisStart: "top",
  crossAxisEnd: "bottom",
  crossAxisSize: "height"
};
var isTotallyVisibleThroughFrameOnAxis = /* @__PURE__ */ __name((axis) => (frame) => {
  const isWithinVertical = isWithin(frame.top, frame.bottom);
  const isWithinHorizontal = isWithin(frame.left, frame.right);
  return (subject) => {
    if (axis === vertical) {
      return isWithinVertical(subject.top) && isWithinVertical(subject.bottom);
    }
    return isWithinHorizontal(subject.left) && isWithinHorizontal(subject.right);
  };
}, "isTotallyVisibleThroughFrameOnAxis");
const getDroppableDisplaced = /* @__PURE__ */ __name((target, destination) => {
  const displacement = destination.frame ? destination.frame.scroll.diff.displacement : origin;
  return offsetByPosition(target, displacement);
}, "getDroppableDisplaced");
const isVisibleInDroppable = /* @__PURE__ */ __name((target, destination, isVisibleThroughFrameFn) => {
  if (!destination.subject.active) {
    return false;
  }
  return isVisibleThroughFrameFn(destination.subject.active)(target);
}, "isVisibleInDroppable");
const isVisibleInViewport = /* @__PURE__ */ __name((target, viewport, isVisibleThroughFrameFn) => isVisibleThroughFrameFn(viewport)(target), "isVisibleInViewport");
const isVisible$1 = /* @__PURE__ */ __name(({
  target: toBeDisplaced,
  destination,
  viewport,
  withDroppableDisplacement: withDroppableDisplacement2,
  isVisibleThroughFrameFn
}) => {
  const displacedTarget = withDroppableDisplacement2 ? getDroppableDisplaced(toBeDisplaced, destination) : toBeDisplaced;
  return isVisibleInDroppable(displacedTarget, destination, isVisibleThroughFrameFn) && isVisibleInViewport(displacedTarget, viewport, isVisibleThroughFrameFn);
}, "isVisible$1");
const isPartiallyVisible = /* @__PURE__ */ __name((args) => isVisible$1({
  ...args,
  isVisibleThroughFrameFn: isPartiallyVisibleThroughFrame
}), "isPartiallyVisible");
const isTotallyVisible = /* @__PURE__ */ __name((args) => isVisible$1({
  ...args,
  isVisibleThroughFrameFn: isTotallyVisibleThroughFrame
}), "isTotallyVisible");
const isTotallyVisibleOnAxis = /* @__PURE__ */ __name((args) => isVisible$1({
  ...args,
  isVisibleThroughFrameFn: isTotallyVisibleThroughFrameOnAxis(args.destination.axis)
}), "isTotallyVisibleOnAxis");
const getShouldAnimate = /* @__PURE__ */ __name((id, last, forceShouldAnimate) => {
  if (typeof forceShouldAnimate === "boolean") {
    return forceShouldAnimate;
  }
  if (!last) {
    return true;
  }
  const {
    invisible,
    visible
  } = last;
  if (invisible[id]) {
    return false;
  }
  const previous = visible[id];
  return previous ? previous.shouldAnimate : true;
}, "getShouldAnimate");
function getTarget(draggable2, displacedBy) {
  const marginBox = draggable2.page.marginBox;
  const expandBy = {
    top: displacedBy.point.y,
    right: 0,
    bottom: 0,
    left: displacedBy.point.x
  };
  return getRect(expand(marginBox, expandBy));
}
__name(getTarget, "getTarget");
function getDisplacementGroups({
  afterDragging,
  destination,
  displacedBy,
  viewport,
  forceShouldAnimate,
  last
}) {
  return afterDragging.reduce(/* @__PURE__ */ __name(function process2(groups, draggable2) {
    const target = getTarget(draggable2, displacedBy);
    const id = draggable2.descriptor.id;
    groups.all.push(id);
    const isVisible2 = isPartiallyVisible({
      target,
      destination,
      viewport,
      withDroppableDisplacement: true
    });
    if (!isVisible2) {
      groups.invisible[draggable2.descriptor.id] = true;
      return groups;
    }
    const shouldAnimate = getShouldAnimate(id, last, forceShouldAnimate);
    const displacement = {
      draggableId: id,
      shouldAnimate
    };
    groups.visible[id] = displacement;
    return groups;
  }, "process2"), {
    all: [],
    visible: {},
    invisible: {}
  });
}
__name(getDisplacementGroups, "getDisplacementGroups");
function getIndexOfLastItem(draggables, options) {
  if (!draggables.length) {
    return 0;
  }
  const indexOfLastItem = draggables[draggables.length - 1].descriptor.index;
  return options.inHomeList ? indexOfLastItem : indexOfLastItem + 1;
}
__name(getIndexOfLastItem, "getIndexOfLastItem");
function goAtEnd({
  insideDestination,
  inHomeList,
  displacedBy,
  destination
}) {
  const newIndex = getIndexOfLastItem(insideDestination, {
    inHomeList
  });
  return {
    displaced: emptyGroups,
    displacedBy,
    at: {
      type: "REORDER",
      destination: {
        droppableId: destination.descriptor.id,
        index: newIndex
      }
    }
  };
}
__name(goAtEnd, "goAtEnd");
function calculateReorderImpact({
  draggable: draggable2,
  insideDestination,
  destination,
  viewport,
  displacedBy,
  last,
  index,
  forceShouldAnimate
}) {
  const inHomeList = isHomeOf(draggable2, destination);
  if (index == null) {
    return goAtEnd({
      insideDestination,
      inHomeList,
      displacedBy,
      destination
    });
  }
  const match = insideDestination.find((item) => item.descriptor.index === index);
  if (!match) {
    return goAtEnd({
      insideDestination,
      inHomeList,
      displacedBy,
      destination
    });
  }
  const withoutDragging = removeDraggableFromList(draggable2, insideDestination);
  const sliceFrom = insideDestination.indexOf(match);
  const impacted = withoutDragging.slice(sliceFrom);
  const displaced = getDisplacementGroups({
    afterDragging: impacted,
    destination,
    displacedBy,
    last,
    viewport: viewport.frame,
    forceShouldAnimate
  });
  return {
    displaced,
    displacedBy,
    at: {
      type: "REORDER",
      destination: {
        droppableId: destination.descriptor.id,
        index
      }
    }
  };
}
__name(calculateReorderImpact, "calculateReorderImpact");
function didStartAfterCritical(draggableId, afterCritical) {
  return Boolean(afterCritical.effected[draggableId]);
}
__name(didStartAfterCritical, "didStartAfterCritical");
var fromCombine = /* @__PURE__ */ __name(({
  isMovingForward,
  destination,
  draggables,
  combine: combine2,
  afterCritical
}) => {
  if (!destination.isCombineEnabled) {
    return null;
  }
  const combineId = combine2.draggableId;
  const combineWith = draggables[combineId];
  const combineWithIndex = combineWith.descriptor.index;
  const didCombineWithStartAfterCritical = didStartAfterCritical(combineId, afterCritical);
  if (didCombineWithStartAfterCritical) {
    if (isMovingForward) {
      return combineWithIndex;
    }
    return combineWithIndex - 1;
  }
  if (isMovingForward) {
    return combineWithIndex + 1;
  }
  return combineWithIndex;
}, "fromCombine");
var fromReorder = /* @__PURE__ */ __name(({
  isMovingForward,
  isInHomeList,
  insideDestination,
  location
}) => {
  if (!insideDestination.length) {
    return null;
  }
  const currentIndex = location.index;
  const proposedIndex = isMovingForward ? currentIndex + 1 : currentIndex - 1;
  const firstIndex = insideDestination[0].descriptor.index;
  const lastIndex = insideDestination[insideDestination.length - 1].descriptor.index;
  const upperBound = isInHomeList ? lastIndex : lastIndex + 1;
  if (proposedIndex < firstIndex) {
    return null;
  }
  if (proposedIndex > upperBound) {
    return null;
  }
  return proposedIndex;
}, "fromReorder");
var moveToNextIndex = /* @__PURE__ */ __name(({
  isMovingForward,
  isInHomeList,
  draggable: draggable2,
  draggables,
  destination,
  insideDestination,
  previousImpact,
  viewport,
  afterCritical
}) => {
  const wasAt = previousImpact.at;
  !wasAt ? invariant() : void 0;
  if (wasAt.type === "REORDER") {
    const newIndex2 = fromReorder({
      isMovingForward,
      isInHomeList,
      location: wasAt.destination,
      insideDestination
    });
    if (newIndex2 == null) {
      return null;
    }
    return calculateReorderImpact({
      draggable: draggable2,
      insideDestination,
      destination,
      viewport,
      last: previousImpact.displaced,
      displacedBy: previousImpact.displacedBy,
      index: newIndex2
    });
  }
  const newIndex = fromCombine({
    isMovingForward,
    destination,
    displaced: previousImpact.displaced,
    draggables,
    combine: wasAt.combine,
    afterCritical
  });
  if (newIndex == null) {
    return null;
  }
  return calculateReorderImpact({
    draggable: draggable2,
    insideDestination,
    destination,
    viewport,
    last: previousImpact.displaced,
    displacedBy: previousImpact.displacedBy,
    index: newIndex
  });
}, "moveToNextIndex");
var getCombinedItemDisplacement = /* @__PURE__ */ __name(({
  displaced,
  afterCritical,
  combineWith,
  displacedBy
}) => {
  const isDisplaced = Boolean(displaced.visible[combineWith] || displaced.invisible[combineWith]);
  if (didStartAfterCritical(combineWith, afterCritical)) {
    return isDisplaced ? origin : negate(displacedBy.point);
  }
  return isDisplaced ? displacedBy.point : origin;
}, "getCombinedItemDisplacement");
var whenCombining = /* @__PURE__ */ __name(({
  afterCritical,
  impact,
  draggables
}) => {
  const combine2 = tryGetCombine(impact);
  !combine2 ? invariant() : void 0;
  const combineWith = combine2.draggableId;
  const center = draggables[combineWith].page.borderBox.center;
  const displaceBy = getCombinedItemDisplacement({
    displaced: impact.displaced,
    afterCritical,
    combineWith,
    displacedBy: impact.displacedBy
  });
  return add(center, displaceBy);
}, "whenCombining");
const distanceFromStartToBorderBoxCenter = /* @__PURE__ */ __name((axis, box) => box.margin[axis.start] + box.borderBox[axis.size] / 2, "distanceFromStartToBorderBoxCenter");
const distanceFromEndToBorderBoxCenter = /* @__PURE__ */ __name((axis, box) => box.margin[axis.end] + box.borderBox[axis.size] / 2, "distanceFromEndToBorderBoxCenter");
const getCrossAxisBorderBoxCenter = /* @__PURE__ */ __name((axis, target, isMoving) => target[axis.crossAxisStart] + isMoving.margin[axis.crossAxisStart] + isMoving.borderBox[axis.crossAxisSize] / 2, "getCrossAxisBorderBoxCenter");
const goAfter = /* @__PURE__ */ __name(({
  axis,
  moveRelativeTo,
  isMoving
}) => patch(axis.line, moveRelativeTo.marginBox[axis.end] + distanceFromStartToBorderBoxCenter(axis, isMoving), getCrossAxisBorderBoxCenter(axis, moveRelativeTo.marginBox, isMoving)), "goAfter");
const goBefore = /* @__PURE__ */ __name(({
  axis,
  moveRelativeTo,
  isMoving
}) => patch(axis.line, moveRelativeTo.marginBox[axis.start] - distanceFromEndToBorderBoxCenter(axis, isMoving), getCrossAxisBorderBoxCenter(axis, moveRelativeTo.marginBox, isMoving)), "goBefore");
const goIntoStart = /* @__PURE__ */ __name(({
  axis,
  moveInto,
  isMoving
}) => patch(axis.line, moveInto.contentBox[axis.start] + distanceFromStartToBorderBoxCenter(axis, isMoving), getCrossAxisBorderBoxCenter(axis, moveInto.contentBox, isMoving)), "goIntoStart");
var whenReordering = /* @__PURE__ */ __name(({
  impact,
  draggable: draggable2,
  draggables,
  droppable: droppable2,
  afterCritical
}) => {
  const insideDestination = getDraggablesInsideDroppable(droppable2.descriptor.id, draggables);
  const draggablePage = draggable2.page;
  const axis = droppable2.axis;
  if (!insideDestination.length) {
    return goIntoStart({
      axis,
      moveInto: droppable2.page,
      isMoving: draggablePage
    });
  }
  const {
    displaced,
    displacedBy
  } = impact;
  const closestAfter = displaced.all[0];
  if (closestAfter) {
    const closest2 = draggables[closestAfter];
    if (didStartAfterCritical(closestAfter, afterCritical)) {
      return goBefore({
        axis,
        moveRelativeTo: closest2.page,
        isMoving: draggablePage
      });
    }
    const withDisplacement = offset(closest2.page, displacedBy.point);
    return goBefore({
      axis,
      moveRelativeTo: withDisplacement,
      isMoving: draggablePage
    });
  }
  const last = insideDestination[insideDestination.length - 1];
  if (last.descriptor.id === draggable2.descriptor.id) {
    return draggablePage.borderBox.center;
  }
  if (didStartAfterCritical(last.descriptor.id, afterCritical)) {
    const page = offset(last.page, negate(afterCritical.displacedBy.point));
    return goAfter({
      axis,
      moveRelativeTo: page,
      isMoving: draggablePage
    });
  }
  return goAfter({
    axis,
    moveRelativeTo: last.page,
    isMoving: draggablePage
  });
}, "whenReordering");
var withDroppableDisplacement = /* @__PURE__ */ __name((droppable2, point) => {
  const frame = droppable2.frame;
  if (!frame) {
    return point;
  }
  return add(point, frame.scroll.diff.displacement);
}, "withDroppableDisplacement");
const getResultWithoutDroppableDisplacement = /* @__PURE__ */ __name(({
  impact,
  draggable: draggable2,
  droppable: droppable2,
  draggables,
  afterCritical
}) => {
  const original = draggable2.page.borderBox.center;
  const at = impact.at;
  if (!droppable2) {
    return original;
  }
  if (!at) {
    return original;
  }
  if (at.type === "REORDER") {
    return whenReordering({
      impact,
      draggable: draggable2,
      draggables,
      droppable: droppable2,
      afterCritical
    });
  }
  return whenCombining({
    impact,
    draggables,
    afterCritical
  });
}, "getResultWithoutDroppableDisplacement");
var getPageBorderBoxCenterFromImpact = /* @__PURE__ */ __name((args) => {
  const withoutDisplacement = getResultWithoutDroppableDisplacement(args);
  const droppable2 = args.droppable;
  const withDisplacement = droppable2 ? withDroppableDisplacement(droppable2, withoutDisplacement) : withoutDisplacement;
  return withDisplacement;
}, "getPageBorderBoxCenterFromImpact");
var scrollViewport = /* @__PURE__ */ __name((viewport, newScroll) => {
  const diff = subtract(newScroll, viewport.scroll.initial);
  const displacement = negate(diff);
  const frame = getRect({
    top: newScroll.y,
    bottom: newScroll.y + viewport.frame.height,
    left: newScroll.x,
    right: newScroll.x + viewport.frame.width
  });
  const updated = {
    frame,
    scroll: {
      initial: viewport.scroll.initial,
      max: viewport.scroll.max,
      current: newScroll,
      diff: {
        value: diff,
        displacement
      }
    }
  };
  return updated;
}, "scrollViewport");
function getDraggables$1(ids, draggables) {
  return ids.map((id) => draggables[id]);
}
__name(getDraggables$1, "getDraggables$1");
function tryGetVisible(id, groups) {
  for (let i = 0; i < groups.length; i++) {
    const displacement = groups[i].visible[id];
    if (displacement) {
      return displacement;
    }
  }
  return null;
}
__name(tryGetVisible, "tryGetVisible");
var speculativelyIncrease = /* @__PURE__ */ __name(({
  impact,
  viewport,
  destination,
  draggables,
  maxScrollChange
}) => {
  const scrolledViewport = scrollViewport(viewport, add(viewport.scroll.current, maxScrollChange));
  const scrolledDroppable = destination.frame ? scrollDroppable(destination, add(destination.frame.scroll.current, maxScrollChange)) : destination;
  const last = impact.displaced;
  const withViewportScroll = getDisplacementGroups({
    afterDragging: getDraggables$1(last.all, draggables),
    destination,
    displacedBy: impact.displacedBy,
    viewport: scrolledViewport.frame,
    last,
    forceShouldAnimate: false
  });
  const withDroppableScroll2 = getDisplacementGroups({
    afterDragging: getDraggables$1(last.all, draggables),
    destination: scrolledDroppable,
    displacedBy: impact.displacedBy,
    viewport: viewport.frame,
    last,
    forceShouldAnimate: false
  });
  const invisible = {};
  const visible = {};
  const groups = [last, withViewportScroll, withDroppableScroll2];
  last.all.forEach((id) => {
    const displacement = tryGetVisible(id, groups);
    if (displacement) {
      visible[id] = displacement;
      return;
    }
    invisible[id] = true;
  });
  const newImpact = {
    ...impact,
    displaced: {
      all: last.all,
      invisible,
      visible
    }
  };
  return newImpact;
}, "speculativelyIncrease");
var withViewportDisplacement = /* @__PURE__ */ __name((viewport, point) => add(viewport.scroll.diff.displacement, point), "withViewportDisplacement");
var getClientFromPageBorderBoxCenter = /* @__PURE__ */ __name(({
  pageBorderBoxCenter,
  draggable: draggable2,
  viewport
}) => {
  const withoutPageScrollChange = withViewportDisplacement(viewport, pageBorderBoxCenter);
  const offset22 = subtract(withoutPageScrollChange, draggable2.page.borderBox.center);
  return add(draggable2.client.borderBox.center, offset22);
}, "getClientFromPageBorderBoxCenter");
var isTotallyVisibleInNewLocation = /* @__PURE__ */ __name(({
  draggable: draggable2,
  destination,
  newPageBorderBoxCenter,
  viewport,
  withDroppableDisplacement: withDroppableDisplacement2,
  onlyOnMainAxis = false
}) => {
  const changeNeeded = subtract(newPageBorderBoxCenter, draggable2.page.borderBox.center);
  const shifted = offsetByPosition(draggable2.page.borderBox, changeNeeded);
  const args = {
    target: shifted,
    destination,
    withDroppableDisplacement: withDroppableDisplacement2,
    viewport
  };
  return onlyOnMainAxis ? isTotallyVisibleOnAxis(args) : isTotallyVisible(args);
}, "isTotallyVisibleInNewLocation");
var moveToNextPlace = /* @__PURE__ */ __name(({
  isMovingForward,
  draggable: draggable2,
  destination,
  draggables,
  previousImpact,
  viewport,
  previousPageBorderBoxCenter,
  previousClientSelection,
  afterCritical
}) => {
  if (!destination.isEnabled) {
    return null;
  }
  const insideDestination = getDraggablesInsideDroppable(destination.descriptor.id, draggables);
  const isInHomeList = isHomeOf(draggable2, destination);
  const impact = moveToNextCombine({
    isMovingForward,
    draggable: draggable2,
    destination,
    insideDestination,
    previousImpact
  }) || moveToNextIndex({
    isMovingForward,
    isInHomeList,
    draggable: draggable2,
    draggables,
    destination,
    insideDestination,
    previousImpact,
    viewport,
    afterCritical
  });
  if (!impact) {
    return null;
  }
  const pageBorderBoxCenter = getPageBorderBoxCenterFromImpact({
    impact,
    draggable: draggable2,
    droppable: destination,
    draggables,
    afterCritical
  });
  const isVisibleInNewLocation = isTotallyVisibleInNewLocation({
    draggable: draggable2,
    destination,
    newPageBorderBoxCenter: pageBorderBoxCenter,
    viewport: viewport.frame,
    withDroppableDisplacement: false,
    onlyOnMainAxis: true
  });
  if (isVisibleInNewLocation) {
    const clientSelection = getClientFromPageBorderBoxCenter({
      pageBorderBoxCenter,
      draggable: draggable2,
      viewport
    });
    return {
      clientSelection,
      impact,
      scrollJumpRequest: null
    };
  }
  const distance2 = subtract(pageBorderBoxCenter, previousPageBorderBoxCenter);
  const cautious = speculativelyIncrease({
    impact,
    viewport,
    destination,
    draggables,
    maxScrollChange: distance2
  });
  return {
    clientSelection: previousClientSelection,
    impact: cautious,
    scrollJumpRequest: distance2
  };
}, "moveToNextPlace");
const getKnownActive = /* @__PURE__ */ __name((droppable2) => {
  const rect = droppable2.subject.active;
  !rect ? invariant() : void 0;
  return rect;
}, "getKnownActive");
var getBestCrossAxisDroppable = /* @__PURE__ */ __name(({
  isMovingForward,
  pageBorderBoxCenter,
  source,
  droppables,
  viewport
}) => {
  const active = source.subject.active;
  if (!active) {
    return null;
  }
  const axis = source.axis;
  const isBetweenSourceClipped = isWithin(active[axis.start], active[axis.end]);
  const candidates = toDroppableList(droppables).filter((droppable2) => droppable2 !== source).filter((droppable2) => droppable2.isEnabled).filter((droppable2) => Boolean(droppable2.subject.active)).filter((droppable2) => isPartiallyVisibleThroughFrame(viewport.frame)(getKnownActive(droppable2))).filter((droppable2) => {
    const activeOfTarget = getKnownActive(droppable2);
    if (isMovingForward) {
      return active[axis.crossAxisEnd] < activeOfTarget[axis.crossAxisEnd];
    }
    return activeOfTarget[axis.crossAxisStart] < active[axis.crossAxisStart];
  }).filter((droppable2) => {
    const activeOfTarget = getKnownActive(droppable2);
    const isBetweenDestinationClipped = isWithin(activeOfTarget[axis.start], activeOfTarget[axis.end]);
    return isBetweenSourceClipped(activeOfTarget[axis.start]) || isBetweenSourceClipped(activeOfTarget[axis.end]) || isBetweenDestinationClipped(active[axis.start]) || isBetweenDestinationClipped(active[axis.end]);
  }).sort((a, b) => {
    const first = getKnownActive(a)[axis.crossAxisStart];
    const second = getKnownActive(b)[axis.crossAxisStart];
    if (isMovingForward) {
      return first - second;
    }
    return second - first;
  }).filter((droppable2, index, array) => getKnownActive(droppable2)[axis.crossAxisStart] === getKnownActive(array[0])[axis.crossAxisStart]);
  if (!candidates.length) {
    return null;
  }
  if (candidates.length === 1) {
    return candidates[0];
  }
  const contains = candidates.filter((droppable2) => {
    const isWithinDroppable = isWithin(getKnownActive(droppable2)[axis.start], getKnownActive(droppable2)[axis.end]);
    return isWithinDroppable(pageBorderBoxCenter[axis.line]);
  });
  if (contains.length === 1) {
    return contains[0];
  }
  if (contains.length > 1) {
    return contains.sort((a, b) => getKnownActive(a)[axis.start] - getKnownActive(b)[axis.start])[0];
  }
  return candidates.sort((a, b) => {
    const first = closest$1(pageBorderBoxCenter, getCorners(getKnownActive(a)));
    const second = closest$1(pageBorderBoxCenter, getCorners(getKnownActive(b)));
    if (first !== second) {
      return first - second;
    }
    return getKnownActive(a)[axis.start] - getKnownActive(b)[axis.start];
  })[0];
}, "getBestCrossAxisDroppable");
const getCurrentPageBorderBoxCenter = /* @__PURE__ */ __name((draggable2, afterCritical) => {
  const original = draggable2.page.borderBox.center;
  return didStartAfterCritical(draggable2.descriptor.id, afterCritical) ? subtract(original, afterCritical.displacedBy.point) : original;
}, "getCurrentPageBorderBoxCenter");
const getCurrentPageBorderBox = /* @__PURE__ */ __name((draggable2, afterCritical) => {
  const original = draggable2.page.borderBox;
  return didStartAfterCritical(draggable2.descriptor.id, afterCritical) ? offsetByPosition(original, negate(afterCritical.displacedBy.point)) : original;
}, "getCurrentPageBorderBox");
var getClosestDraggable = /* @__PURE__ */ __name(({
  pageBorderBoxCenter,
  viewport,
  destination,
  insideDestination,
  afterCritical
}) => {
  const sorted = insideDestination.filter((draggable2) => isTotallyVisible({
    target: getCurrentPageBorderBox(draggable2, afterCritical),
    destination,
    viewport: viewport.frame,
    withDroppableDisplacement: true
  })).sort((a, b) => {
    const distanceToA = distance(pageBorderBoxCenter, withDroppableDisplacement(destination, getCurrentPageBorderBoxCenter(a, afterCritical)));
    const distanceToB = distance(pageBorderBoxCenter, withDroppableDisplacement(destination, getCurrentPageBorderBoxCenter(b, afterCritical)));
    if (distanceToA < distanceToB) {
      return -1;
    }
    if (distanceToB < distanceToA) {
      return 1;
    }
    return a.descriptor.index - b.descriptor.index;
  });
  return sorted[0] || null;
}, "getClosestDraggable");
var getDisplacedBy = memoizeOne(/* @__PURE__ */ __name(function getDisplacedBy2(axis, displaceBy) {
  const displacement = displaceBy[axis.line];
  return {
    value: displacement,
    point: patch(axis.line, displacement)
  };
}, "getDisplacedBy2"));
const getRequiredGrowthForPlaceholder = /* @__PURE__ */ __name((droppable2, placeholderSize, draggables) => {
  const axis = droppable2.axis;
  if (droppable2.descriptor.mode === "virtual") {
    return patch(axis.line, placeholderSize[axis.line]);
  }
  const availableSpace = droppable2.subject.page.contentBox[axis.size];
  const insideDroppable = getDraggablesInsideDroppable(droppable2.descriptor.id, draggables);
  const spaceUsed = insideDroppable.reduce((sum, dimension) => sum + dimension.client.marginBox[axis.size], 0);
  const requiredSpace = spaceUsed + placeholderSize[axis.line];
  const needsToGrowBy = requiredSpace - availableSpace;
  if (needsToGrowBy <= 0) {
    return null;
  }
  return patch(axis.line, needsToGrowBy);
}, "getRequiredGrowthForPlaceholder");
const withMaxScroll = /* @__PURE__ */ __name((frame, max) => ({
  ...frame,
  scroll: {
    ...frame.scroll,
    max
  }
}), "withMaxScroll");
const addPlaceholder = /* @__PURE__ */ __name((droppable2, draggable2, draggables) => {
  const frame = droppable2.frame;
  !!isHomeOf(draggable2, droppable2) ? invariant() : void 0;
  !!droppable2.subject.withPlaceholder ? invariant() : void 0;
  const placeholderSize = getDisplacedBy(droppable2.axis, draggable2.displaceBy).point;
  const requiredGrowth = getRequiredGrowthForPlaceholder(droppable2, placeholderSize, draggables);
  const added = {
    placeholderSize,
    increasedBy: requiredGrowth,
    oldFrameMaxScroll: droppable2.frame ? droppable2.frame.scroll.max : null
  };
  if (!frame) {
    const subject2 = getSubject({
      page: droppable2.subject.page,
      withPlaceholder: added,
      axis: droppable2.axis,
      frame: droppable2.frame
    });
    return {
      ...droppable2,
      subject: subject2
    };
  }
  const maxScroll = requiredGrowth ? add(frame.scroll.max, requiredGrowth) : frame.scroll.max;
  const newFrame = withMaxScroll(frame, maxScroll);
  const subject = getSubject({
    page: droppable2.subject.page,
    withPlaceholder: added,
    axis: droppable2.axis,
    frame: newFrame
  });
  return {
    ...droppable2,
    subject,
    frame: newFrame
  };
}, "addPlaceholder");
const removePlaceholder = /* @__PURE__ */ __name((droppable2) => {
  const added = droppable2.subject.withPlaceholder;
  !added ? invariant() : void 0;
  const frame = droppable2.frame;
  if (!frame) {
    const subject2 = getSubject({
      page: droppable2.subject.page,
      axis: droppable2.axis,
      frame: null,
      withPlaceholder: null
    });
    return {
      ...droppable2,
      subject: subject2
    };
  }
  const oldMaxScroll = added.oldFrameMaxScroll;
  !oldMaxScroll ? invariant() : void 0;
  const newFrame = withMaxScroll(frame, oldMaxScroll);
  const subject = getSubject({
    page: droppable2.subject.page,
    axis: droppable2.axis,
    frame: newFrame,
    withPlaceholder: null
  });
  return {
    ...droppable2,
    subject,
    frame: newFrame
  };
}, "removePlaceholder");
var moveToNewDroppable = /* @__PURE__ */ __name(({
  previousPageBorderBoxCenter,
  moveRelativeTo,
  insideDestination,
  draggable: draggable2,
  draggables,
  destination,
  viewport,
  afterCritical
}) => {
  if (!moveRelativeTo) {
    if (insideDestination.length) {
      return null;
    }
    const proposed = {
      displaced: emptyGroups,
      displacedBy: noDisplacedBy,
      at: {
        type: "REORDER",
        destination: {
          droppableId: destination.descriptor.id,
          index: 0
        }
      }
    };
    const proposedPageBorderBoxCenter = getPageBorderBoxCenterFromImpact({
      impact: proposed,
      draggable: draggable2,
      droppable: destination,
      draggables,
      afterCritical
    });
    const withPlaceholder = isHomeOf(draggable2, destination) ? destination : addPlaceholder(destination, draggable2, draggables);
    const isVisibleInNewLocation = isTotallyVisibleInNewLocation({
      draggable: draggable2,
      destination: withPlaceholder,
      newPageBorderBoxCenter: proposedPageBorderBoxCenter,
      viewport: viewport.frame,
      withDroppableDisplacement: false,
      onlyOnMainAxis: true
    });
    return isVisibleInNewLocation ? proposed : null;
  }
  const isGoingBeforeTarget = Boolean(previousPageBorderBoxCenter[destination.axis.line] <= moveRelativeTo.page.borderBox.center[destination.axis.line]);
  const proposedIndex = (() => {
    const relativeTo = moveRelativeTo.descriptor.index;
    if (moveRelativeTo.descriptor.id === draggable2.descriptor.id) {
      return relativeTo;
    }
    if (isGoingBeforeTarget) {
      return relativeTo;
    }
    return relativeTo + 1;
  })();
  const displacedBy = getDisplacedBy(destination.axis, draggable2.displaceBy);
  return calculateReorderImpact({
    draggable: draggable2,
    insideDestination,
    destination,
    viewport,
    displacedBy,
    last: emptyGroups,
    index: proposedIndex
  });
}, "moveToNewDroppable");
var moveCrossAxis = /* @__PURE__ */ __name(({
  isMovingForward,
  previousPageBorderBoxCenter,
  draggable: draggable2,
  isOver,
  draggables,
  droppables,
  viewport,
  afterCritical
}) => {
  const destination = getBestCrossAxisDroppable({
    isMovingForward,
    pageBorderBoxCenter: previousPageBorderBoxCenter,
    source: isOver,
    droppables,
    viewport
  });
  if (!destination) {
    return null;
  }
  const insideDestination = getDraggablesInsideDroppable(destination.descriptor.id, draggables);
  const moveRelativeTo = getClosestDraggable({
    pageBorderBoxCenter: previousPageBorderBoxCenter,
    viewport,
    destination,
    insideDestination,
    afterCritical
  });
  const impact = moveToNewDroppable({
    previousPageBorderBoxCenter,
    destination,
    draggable: draggable2,
    draggables,
    moveRelativeTo,
    insideDestination,
    viewport,
    afterCritical
  });
  if (!impact) {
    return null;
  }
  const pageBorderBoxCenter = getPageBorderBoxCenterFromImpact({
    impact,
    draggable: draggable2,
    droppable: destination,
    draggables,
    afterCritical
  });
  const clientSelection = getClientFromPageBorderBoxCenter({
    pageBorderBoxCenter,
    draggable: draggable2,
    viewport
  });
  return {
    clientSelection,
    impact,
    scrollJumpRequest: null
  };
}, "moveCrossAxis");
var whatIsDraggedOver = /* @__PURE__ */ __name((impact) => {
  const at = impact.at;
  if (!at) {
    return null;
  }
  if (at.type === "REORDER") {
    return at.destination.droppableId;
  }
  return at.combine.droppableId;
}, "whatIsDraggedOver");
const getDroppableOver$1 = /* @__PURE__ */ __name((impact, droppables) => {
  const id = whatIsDraggedOver(impact);
  return id ? droppables[id] : null;
}, "getDroppableOver$1");
var moveInDirection = /* @__PURE__ */ __name(({
  state,
  type
}) => {
  const isActuallyOver = getDroppableOver$1(state.impact, state.dimensions.droppables);
  const isMainAxisMovementAllowed = Boolean(isActuallyOver);
  const home2 = state.dimensions.droppables[state.critical.droppable.id];
  const isOver = isActuallyOver || home2;
  const direction = isOver.axis.direction;
  const isMovingOnMainAxis = direction === "vertical" && (type === "MOVE_UP" || type === "MOVE_DOWN") || direction === "horizontal" && (type === "MOVE_LEFT" || type === "MOVE_RIGHT");
  if (isMovingOnMainAxis && !isMainAxisMovementAllowed) {
    return null;
  }
  const isMovingForward = type === "MOVE_DOWN" || type === "MOVE_RIGHT";
  const draggable2 = state.dimensions.draggables[state.critical.draggable.id];
  const previousPageBorderBoxCenter = state.current.page.borderBoxCenter;
  const {
    draggables,
    droppables
  } = state.dimensions;
  return isMovingOnMainAxis ? moveToNextPlace({
    isMovingForward,
    previousPageBorderBoxCenter,
    draggable: draggable2,
    destination: isOver,
    draggables,
    viewport: state.viewport,
    previousClientSelection: state.current.client.selection,
    previousImpact: state.impact,
    afterCritical: state.afterCritical
  }) : moveCrossAxis({
    isMovingForward,
    previousPageBorderBoxCenter,
    draggable: draggable2,
    isOver,
    draggables,
    droppables,
    viewport: state.viewport,
    afterCritical: state.afterCritical
  });
}, "moveInDirection");
function isMovementAllowed(state) {
  return state.phase === "DRAGGING" || state.phase === "COLLECTING";
}
__name(isMovementAllowed, "isMovementAllowed");
function isPositionInFrame(frame) {
  const isWithinVertical = isWithin(frame.top, frame.bottom);
  const isWithinHorizontal = isWithin(frame.left, frame.right);
  return /* @__PURE__ */ __name(function run(point) {
    return isWithinVertical(point.y) && isWithinHorizontal(point.x);
  }, "run");
}
__name(isPositionInFrame, "isPositionInFrame");
function getHasOverlap(first, second) {
  return first.left < second.right && first.right > second.left && first.top < second.bottom && first.bottom > second.top;
}
__name(getHasOverlap, "getHasOverlap");
function getFurthestAway({
  pageBorderBox,
  draggable: draggable2,
  candidates
}) {
  const startCenter = draggable2.page.borderBox.center;
  const sorted = candidates.map((candidate) => {
    const axis = candidate.axis;
    const target = patch(candidate.axis.line, pageBorderBox.center[axis.line], candidate.page.borderBox.center[axis.crossAxisLine]);
    return {
      id: candidate.descriptor.id,
      distance: distance(startCenter, target)
    };
  }).sort((a, b) => b.distance - a.distance);
  return sorted[0] ? sorted[0].id : null;
}
__name(getFurthestAway, "getFurthestAway");
function getDroppableOver({
  pageBorderBox,
  draggable: draggable2,
  droppables
}) {
  const candidates = toDroppableList(droppables).filter((item) => {
    if (!item.isEnabled) {
      return false;
    }
    const active = item.subject.active;
    if (!active) {
      return false;
    }
    if (!getHasOverlap(pageBorderBox, active)) {
      return false;
    }
    if (isPositionInFrame(active)(pageBorderBox.center)) {
      return true;
    }
    const axis = item.axis;
    const childCenter = active.center[axis.crossAxisLine];
    const crossAxisStart = pageBorderBox[axis.crossAxisStart];
    const crossAxisEnd = pageBorderBox[axis.crossAxisEnd];
    const isContained = isWithin(active[axis.crossAxisStart], active[axis.crossAxisEnd]);
    const isStartContained = isContained(crossAxisStart);
    const isEndContained = isContained(crossAxisEnd);
    if (!isStartContained && !isEndContained) {
      return true;
    }
    if (isStartContained) {
      return crossAxisStart < childCenter;
    }
    return crossAxisEnd > childCenter;
  });
  if (!candidates.length) {
    return null;
  }
  if (candidates.length === 1) {
    return candidates[0].descriptor.id;
  }
  return getFurthestAway({
    pageBorderBox,
    draggable: draggable2,
    candidates
  });
}
__name(getDroppableOver, "getDroppableOver");
const offsetRectByPosition = /* @__PURE__ */ __name((rect, point) => getRect(offsetByPosition(rect, point)), "offsetRectByPosition");
var withDroppableScroll = /* @__PURE__ */ __name((droppable2, area) => {
  const frame = droppable2.frame;
  if (!frame) {
    return area;
  }
  return offsetRectByPosition(area, frame.scroll.diff.value);
}, "withDroppableScroll");
function getIsDisplaced({
  displaced,
  id
}) {
  return Boolean(displaced.visible[id] || displaced.invisible[id]);
}
__name(getIsDisplaced, "getIsDisplaced");
function atIndex({
  draggable: draggable2,
  closest: closest2,
  inHomeList
}) {
  if (!closest2) {
    return null;
  }
  if (!inHomeList) {
    return closest2.descriptor.index;
  }
  if (closest2.descriptor.index > draggable2.descriptor.index) {
    return closest2.descriptor.index - 1;
  }
  return closest2.descriptor.index;
}
__name(atIndex, "atIndex");
var getReorderImpact = /* @__PURE__ */ __name(({
  pageBorderBoxWithDroppableScroll: targetRect,
  draggable: draggable2,
  destination,
  insideDestination,
  last,
  viewport,
  afterCritical
}) => {
  const axis = destination.axis;
  const displacedBy = getDisplacedBy(destination.axis, draggable2.displaceBy);
  const displacement = displacedBy.value;
  const targetStart = targetRect[axis.start];
  const targetEnd = targetRect[axis.end];
  const withoutDragging = removeDraggableFromList(draggable2, insideDestination);
  const closest2 = withoutDragging.find((child) => {
    const id = child.descriptor.id;
    const childCenter = child.page.borderBox.center[axis.line];
    const didStartAfterCritical$1 = didStartAfterCritical(id, afterCritical);
    const isDisplaced = getIsDisplaced({
      displaced: last,
      id
    });
    if (didStartAfterCritical$1) {
      if (isDisplaced) {
        return targetEnd <= childCenter;
      }
      return targetStart < childCenter - displacement;
    }
    if (isDisplaced) {
      return targetEnd <= childCenter + displacement;
    }
    return targetStart < childCenter;
  }) || null;
  const newIndex = atIndex({
    draggable: draggable2,
    closest: closest2,
    inHomeList: isHomeOf(draggable2, destination)
  });
  return calculateReorderImpact({
    draggable: draggable2,
    insideDestination,
    destination,
    viewport,
    last,
    displacedBy,
    index: newIndex
  });
}, "getReorderImpact");
const combineThresholdDivisor = 4;
var getCombineImpact = /* @__PURE__ */ __name(({
  draggable: draggable2,
  pageBorderBoxWithDroppableScroll: targetRect,
  previousImpact,
  destination,
  insideDestination,
  afterCritical
}) => {
  if (!destination.isCombineEnabled) {
    return null;
  }
  const axis = destination.axis;
  const displacedBy = getDisplacedBy(destination.axis, draggable2.displaceBy);
  const displacement = displacedBy.value;
  const targetStart = targetRect[axis.start];
  const targetEnd = targetRect[axis.end];
  const withoutDragging = removeDraggableFromList(draggable2, insideDestination);
  const combineWith = withoutDragging.find((child) => {
    const id = child.descriptor.id;
    const childRect = child.page.borderBox;
    const childSize = childRect[axis.size];
    const threshold = childSize / combineThresholdDivisor;
    const didStartAfterCritical$1 = didStartAfterCritical(id, afterCritical);
    const isDisplaced = getIsDisplaced({
      displaced: previousImpact.displaced,
      id
    });
    if (didStartAfterCritical$1) {
      if (isDisplaced) {
        return targetEnd > childRect[axis.start] + threshold && targetEnd < childRect[axis.end] - threshold;
      }
      return targetStart > childRect[axis.start] - displacement + threshold && targetStart < childRect[axis.end] - displacement - threshold;
    }
    if (isDisplaced) {
      return targetEnd > childRect[axis.start] + displacement + threshold && targetEnd < childRect[axis.end] + displacement - threshold;
    }
    return targetStart > childRect[axis.start] + threshold && targetStart < childRect[axis.end] - threshold;
  });
  if (!combineWith) {
    return null;
  }
  const impact = {
    displacedBy,
    displaced: previousImpact.displaced,
    at: {
      type: "COMBINE",
      combine: {
        draggableId: combineWith.descriptor.id,
        droppableId: destination.descriptor.id
      }
    }
  };
  return impact;
}, "getCombineImpact");
var getDragImpact = /* @__PURE__ */ __name(({
  pageOffset,
  draggable: draggable2,
  draggables,
  droppables,
  previousImpact,
  viewport,
  afterCritical
}) => {
  const pageBorderBox = offsetRectByPosition(draggable2.page.borderBox, pageOffset);
  const destinationId = getDroppableOver({
    pageBorderBox,
    draggable: draggable2,
    droppables
  });
  if (!destinationId) {
    return noImpact;
  }
  const destination = droppables[destinationId];
  const insideDestination = getDraggablesInsideDroppable(destination.descriptor.id, draggables);
  const pageBorderBoxWithDroppableScroll = withDroppableScroll(destination, pageBorderBox);
  return getCombineImpact({
    pageBorderBoxWithDroppableScroll,
    draggable: draggable2,
    previousImpact,
    destination,
    insideDestination,
    afterCritical
  }) || getReorderImpact({
    pageBorderBoxWithDroppableScroll,
    draggable: draggable2,
    destination,
    insideDestination,
    last: previousImpact.displaced,
    viewport,
    afterCritical
  });
}, "getDragImpact");
var patchDroppableMap = /* @__PURE__ */ __name((droppables, updated) => ({
  ...droppables,
  [updated.descriptor.id]: updated
}), "patchDroppableMap");
const clearUnusedPlaceholder = /* @__PURE__ */ __name(({
  previousImpact,
  impact,
  droppables
}) => {
  const last = whatIsDraggedOver(previousImpact);
  const now = whatIsDraggedOver(impact);
  if (!last) {
    return droppables;
  }
  if (last === now) {
    return droppables;
  }
  const lastDroppable = droppables[last];
  if (!lastDroppable.subject.withPlaceholder) {
    return droppables;
  }
  const updated = removePlaceholder(lastDroppable);
  return patchDroppableMap(droppables, updated);
}, "clearUnusedPlaceholder");
var recomputePlaceholders = /* @__PURE__ */ __name(({
  draggable: draggable2,
  draggables,
  droppables,
  previousImpact,
  impact
}) => {
  const cleaned = clearUnusedPlaceholder({
    previousImpact,
    impact,
    droppables
  });
  const isOver = whatIsDraggedOver(impact);
  if (!isOver) {
    return cleaned;
  }
  const droppable2 = droppables[isOver];
  if (isHomeOf(draggable2, droppable2)) {
    return cleaned;
  }
  if (droppable2.subject.withPlaceholder) {
    return cleaned;
  }
  const patched = addPlaceholder(droppable2, draggable2, draggables);
  return patchDroppableMap(cleaned, patched);
}, "recomputePlaceholders");
var update = /* @__PURE__ */ __name(({
  state,
  clientSelection: forcedClientSelection,
  dimensions: forcedDimensions,
  viewport: forcedViewport,
  impact: forcedImpact,
  scrollJumpRequest
}) => {
  const viewport = forcedViewport || state.viewport;
  const dimensions = forcedDimensions || state.dimensions;
  const clientSelection = forcedClientSelection || state.current.client.selection;
  const offset22 = subtract(clientSelection, state.initial.client.selection);
  const client = {
    offset: offset22,
    selection: clientSelection,
    borderBoxCenter: add(state.initial.client.borderBoxCenter, offset22)
  };
  const page = {
    selection: add(client.selection, viewport.scroll.current),
    borderBoxCenter: add(client.borderBoxCenter, viewport.scroll.current),
    offset: add(client.offset, viewport.scroll.diff.value)
  };
  const current = {
    client,
    page
  };
  if (state.phase === "COLLECTING") {
    return {
      ...state,
      dimensions,
      viewport,
      current
    };
  }
  const draggable2 = dimensions.draggables[state.critical.draggable.id];
  const newImpact = forcedImpact || getDragImpact({
    pageOffset: page.offset,
    draggable: draggable2,
    draggables: dimensions.draggables,
    droppables: dimensions.droppables,
    previousImpact: state.impact,
    viewport,
    afterCritical: state.afterCritical
  });
  const withUpdatedPlaceholders = recomputePlaceholders({
    draggable: draggable2,
    impact: newImpact,
    previousImpact: state.impact,
    draggables: dimensions.draggables,
    droppables: dimensions.droppables
  });
  const result = {
    ...state,
    current,
    dimensions: {
      draggables: dimensions.draggables,
      droppables: withUpdatedPlaceholders
    },
    impact: newImpact,
    viewport,
    scrollJumpRequest: scrollJumpRequest || null,
    forceShouldAnimate: scrollJumpRequest ? false : null
  };
  return result;
}, "update");
function getDraggables(ids, draggables) {
  return ids.map((id) => draggables[id]);
}
__name(getDraggables, "getDraggables");
var recompute = /* @__PURE__ */ __name(({
  impact,
  viewport,
  draggables,
  destination,
  forceShouldAnimate
}) => {
  const last = impact.displaced;
  const afterDragging = getDraggables(last.all, draggables);
  const displaced = getDisplacementGroups({
    afterDragging,
    destination,
    displacedBy: impact.displacedBy,
    viewport: viewport.frame,
    forceShouldAnimate,
    last
  });
  return {
    ...impact,
    displaced
  };
}, "recompute");
var getClientBorderBoxCenter = /* @__PURE__ */ __name(({
  impact,
  draggable: draggable2,
  droppable: droppable2,
  draggables,
  viewport,
  afterCritical
}) => {
  const pageBorderBoxCenter = getPageBorderBoxCenterFromImpact({
    impact,
    draggable: draggable2,
    draggables,
    droppable: droppable2,
    afterCritical
  });
  return getClientFromPageBorderBoxCenter({
    pageBorderBoxCenter,
    draggable: draggable2,
    viewport
  });
}, "getClientBorderBoxCenter");
var refreshSnap = /* @__PURE__ */ __name(({
  state,
  dimensions: forcedDimensions,
  viewport: forcedViewport
}) => {
  !(state.movementMode === "SNAP") ? invariant() : void 0;
  const needsVisibilityCheck = state.impact;
  const viewport = forcedViewport || state.viewport;
  const dimensions = forcedDimensions || state.dimensions;
  const {
    draggables,
    droppables
  } = dimensions;
  const draggable2 = draggables[state.critical.draggable.id];
  const isOver = whatIsDraggedOver(needsVisibilityCheck);
  !isOver ? invariant() : void 0;
  const destination = droppables[isOver];
  const impact = recompute({
    impact: needsVisibilityCheck,
    viewport,
    destination,
    draggables
  });
  const clientSelection = getClientBorderBoxCenter({
    impact,
    draggable: draggable2,
    droppable: destination,
    draggables,
    viewport,
    afterCritical: state.afterCritical
  });
  return update({
    impact,
    clientSelection,
    state,
    dimensions,
    viewport
  });
}, "refreshSnap");
var getHomeLocation = /* @__PURE__ */ __name((descriptor) => ({
  index: descriptor.index,
  droppableId: descriptor.droppableId
}), "getHomeLocation");
var getLiftEffect = /* @__PURE__ */ __name(({
  draggable: draggable2,
  home: home2,
  draggables,
  viewport
}) => {
  const displacedBy = getDisplacedBy(home2.axis, draggable2.displaceBy);
  const insideHome = getDraggablesInsideDroppable(home2.descriptor.id, draggables);
  const rawIndex = insideHome.indexOf(draggable2);
  !(rawIndex !== -1) ? invariant() : void 0;
  const afterDragging = insideHome.slice(rawIndex + 1);
  const effected = afterDragging.reduce((previous, item) => {
    previous[item.descriptor.id] = true;
    return previous;
  }, {});
  const afterCritical = {
    inVirtualList: home2.descriptor.mode === "virtual",
    displacedBy,
    effected
  };
  const displaced = getDisplacementGroups({
    afterDragging,
    destination: home2,
    displacedBy,
    last: null,
    viewport: viewport.frame,
    forceShouldAnimate: false
  });
  const impact = {
    displaced,
    displacedBy,
    at: {
      type: "REORDER",
      destination: getHomeLocation(draggable2.descriptor)
    }
  };
  return {
    impact,
    afterCritical
  };
}, "getLiftEffect");
var patchDimensionMap = /* @__PURE__ */ __name((dimensions, updated) => ({
  draggables: dimensions.draggables,
  droppables: patchDroppableMap(dimensions.droppables, updated)
}), "patchDimensionMap");
var offsetDraggable = /* @__PURE__ */ __name(({
  draggable: draggable2,
  offset: offset$1,
  initialWindowScroll
}) => {
  const client = offset(draggable2.client, offset$1);
  const page = withScroll(client, initialWindowScroll);
  const moved = {
    ...draggable2,
    placeholder: {
      ...draggable2.placeholder,
      client
    },
    client,
    page
  };
  return moved;
}, "offsetDraggable");
var getFrame = /* @__PURE__ */ __name((droppable2) => {
  const frame = droppable2.frame;
  !frame ? invariant() : void 0;
  return frame;
}, "getFrame");
var adjustAdditionsForScrollChanges = /* @__PURE__ */ __name(({
  additions,
  updatedDroppables,
  viewport
}) => {
  const windowScrollChange = viewport.scroll.diff.value;
  return additions.map((draggable2) => {
    const droppableId = draggable2.descriptor.droppableId;
    const modified = updatedDroppables[droppableId];
    const frame = getFrame(modified);
    const droppableScrollChange = frame.scroll.diff.value;
    const totalChange = add(windowScrollChange, droppableScrollChange);
    const moved = offsetDraggable({
      draggable: draggable2,
      offset: totalChange,
      initialWindowScroll: viewport.scroll.initial
    });
    return moved;
  });
}, "adjustAdditionsForScrollChanges");
var publishWhileDraggingInVirtual = /* @__PURE__ */ __name(({
  state,
  published
}) => {
  const withScrollChange = published.modified.map((update2) => {
    const existing = state.dimensions.droppables[update2.droppableId];
    const scrolled = scrollDroppable(existing, update2.scroll);
    return scrolled;
  });
  const droppables = {
    ...state.dimensions.droppables,
    ...toDroppableMap(withScrollChange)
  };
  const updatedAdditions = toDraggableMap(adjustAdditionsForScrollChanges({
    additions: published.additions,
    updatedDroppables: droppables,
    viewport: state.viewport
  }));
  const draggables = {
    ...state.dimensions.draggables,
    ...updatedAdditions
  };
  published.removals.forEach((id) => {
    delete draggables[id];
  });
  const dimensions = {
    droppables,
    draggables
  };
  const wasOverId = whatIsDraggedOver(state.impact);
  const wasOver = wasOverId ? dimensions.droppables[wasOverId] : null;
  const draggable2 = dimensions.draggables[state.critical.draggable.id];
  const home2 = dimensions.droppables[state.critical.droppable.id];
  const {
    impact: onLiftImpact,
    afterCritical
  } = getLiftEffect({
    draggable: draggable2,
    home: home2,
    draggables,
    viewport: state.viewport
  });
  const previousImpact = wasOver && wasOver.isCombineEnabled ? state.impact : onLiftImpact;
  const impact = getDragImpact({
    pageOffset: state.current.page.offset,
    draggable: dimensions.draggables[state.critical.draggable.id],
    draggables: dimensions.draggables,
    droppables: dimensions.droppables,
    previousImpact,
    viewport: state.viewport,
    afterCritical
  });
  const draggingState = {
    ...state,
    phase: "DRAGGING",
    impact,
    onLiftImpact,
    dimensions,
    afterCritical,
    forceShouldAnimate: false
  };
  if (state.phase === "COLLECTING") {
    return draggingState;
  }
  const dropPending2 = {
    ...draggingState,
    phase: "DROP_PENDING",
    reason: state.reason,
    isWaiting: false
  };
  return dropPending2;
}, "publishWhileDraggingInVirtual");
const isSnapping = /* @__PURE__ */ __name((state) => state.movementMode === "SNAP", "isSnapping");
const postDroppableChange = /* @__PURE__ */ __name((state, updated, isEnabledChanging) => {
  const dimensions = patchDimensionMap(state.dimensions, updated);
  if (!isSnapping(state) || isEnabledChanging) {
    return update({
      state,
      dimensions
    });
  }
  return refreshSnap({
    state,
    dimensions
  });
}, "postDroppableChange");
function removeScrollJumpRequest(state) {
  if (state.isDragging && state.movementMode === "SNAP") {
    return {
      ...state,
      scrollJumpRequest: null
    };
  }
  return state;
}
__name(removeScrollJumpRequest, "removeScrollJumpRequest");
const idle$2 = {
  phase: "IDLE",
  completed: null,
  shouldFlush: false
};
var reducer = /* @__PURE__ */ __name((state = idle$2, action) => {
  if (action.type === "FLUSH") {
    return {
      ...idle$2,
      shouldFlush: true
    };
  }
  if (action.type === "INITIAL_PUBLISH") {
    !(state.phase === "IDLE") ? invariant() : void 0;
    const {
      critical,
      clientSelection,
      viewport,
      dimensions,
      movementMode
    } = action.payload;
    const draggable2 = dimensions.draggables[critical.draggable.id];
    const home2 = dimensions.droppables[critical.droppable.id];
    const client = {
      selection: clientSelection,
      borderBoxCenter: draggable2.client.borderBox.center,
      offset: origin
    };
    const initial = {
      client,
      page: {
        selection: add(client.selection, viewport.scroll.initial),
        borderBoxCenter: add(client.selection, viewport.scroll.initial),
        offset: add(client.selection, viewport.scroll.diff.value)
      }
    };
    const isWindowScrollAllowed = toDroppableList(dimensions.droppables).every((item) => !item.isFixedOnPage);
    const {
      impact,
      afterCritical
    } = getLiftEffect({
      draggable: draggable2,
      home: home2,
      draggables: dimensions.draggables,
      viewport
    });
    const result = {
      phase: "DRAGGING",
      isDragging: true,
      critical,
      movementMode,
      dimensions,
      initial,
      current: initial,
      isWindowScrollAllowed,
      impact,
      afterCritical,
      onLiftImpact: impact,
      viewport,
      scrollJumpRequest: null,
      forceShouldAnimate: null
    };
    return result;
  }
  if (action.type === "COLLECTION_STARTING") {
    if (state.phase === "COLLECTING" || state.phase === "DROP_PENDING") {
      return state;
    }
    !(state.phase === "DRAGGING") ? invariant() : void 0;
    const result = {
      ...state,
      phase: "COLLECTING"
    };
    return result;
  }
  if (action.type === "PUBLISH_WHILE_DRAGGING") {
    !(state.phase === "COLLECTING" || state.phase === "DROP_PENDING") ? invariant() : void 0;
    return publishWhileDraggingInVirtual({
      state,
      published: action.payload
    });
  }
  if (action.type === "MOVE") {
    if (state.phase === "DROP_PENDING") {
      return state;
    }
    !isMovementAllowed(state) ? invariant() : void 0;
    const {
      client: clientSelection
    } = action.payload;
    if (isEqual$1(clientSelection, state.current.client.selection)) {
      return state;
    }
    return update({
      state,
      clientSelection,
      impact: isSnapping(state) ? state.impact : null
    });
  }
  if (action.type === "UPDATE_DROPPABLE_SCROLL") {
    if (state.phase === "DROP_PENDING") {
      return removeScrollJumpRequest(state);
    }
    if (state.phase === "COLLECTING") {
      return removeScrollJumpRequest(state);
    }
    !isMovementAllowed(state) ? invariant() : void 0;
    const {
      id,
      newScroll
    } = action.payload;
    const target = state.dimensions.droppables[id];
    if (!target) {
      return state;
    }
    const scrolled = scrollDroppable(target, newScroll);
    return postDroppableChange(state, scrolled, false);
  }
  if (action.type === "UPDATE_DROPPABLE_IS_ENABLED") {
    if (state.phase === "DROP_PENDING") {
      return state;
    }
    !isMovementAllowed(state) ? invariant() : void 0;
    const {
      id,
      isEnabled
    } = action.payload;
    const target = state.dimensions.droppables[id];
    !target ? invariant() : void 0;
    !(target.isEnabled !== isEnabled) ? invariant() : void 0;
    const updated = {
      ...target,
      isEnabled
    };
    return postDroppableChange(state, updated, true);
  }
  if (action.type === "UPDATE_DROPPABLE_IS_COMBINE_ENABLED") {
    if (state.phase === "DROP_PENDING") {
      return state;
    }
    !isMovementAllowed(state) ? invariant() : void 0;
    const {
      id,
      isCombineEnabled
    } = action.payload;
    const target = state.dimensions.droppables[id];
    !target ? invariant() : void 0;
    !(target.isCombineEnabled !== isCombineEnabled) ? invariant() : void 0;
    const updated = {
      ...target,
      isCombineEnabled
    };
    return postDroppableChange(state, updated, true);
  }
  if (action.type === "MOVE_BY_WINDOW_SCROLL") {
    if (state.phase === "DROP_PENDING" || state.phase === "DROP_ANIMATING") {
      return state;
    }
    !isMovementAllowed(state) ? invariant() : void 0;
    !state.isWindowScrollAllowed ? invariant() : void 0;
    const newScroll = action.payload.newScroll;
    if (isEqual$1(state.viewport.scroll.current, newScroll)) {
      return removeScrollJumpRequest(state);
    }
    const viewport = scrollViewport(state.viewport, newScroll);
    if (isSnapping(state)) {
      return refreshSnap({
        state,
        viewport
      });
    }
    return update({
      state,
      viewport
    });
  }
  if (action.type === "UPDATE_VIEWPORT_MAX_SCROLL") {
    if (!isMovementAllowed(state)) {
      return state;
    }
    const maxScroll = action.payload.maxScroll;
    if (isEqual$1(maxScroll, state.viewport.scroll.max)) {
      return state;
    }
    const withMaxScroll2 = {
      ...state.viewport,
      scroll: {
        ...state.viewport.scroll,
        max: maxScroll
      }
    };
    return {
      ...state,
      viewport: withMaxScroll2
    };
  }
  if (action.type === "MOVE_UP" || action.type === "MOVE_DOWN" || action.type === "MOVE_LEFT" || action.type === "MOVE_RIGHT") {
    if (state.phase === "COLLECTING" || state.phase === "DROP_PENDING") {
      return state;
    }
    !(state.phase === "DRAGGING") ? invariant() : void 0;
    const result = moveInDirection({
      state,
      type: action.type
    });
    if (!result) {
      return state;
    }
    return update({
      state,
      impact: result.impact,
      clientSelection: result.clientSelection,
      scrollJumpRequest: result.scrollJumpRequest
    });
  }
  if (action.type === "DROP_PENDING") {
    const reason = action.payload.reason;
    !(state.phase === "COLLECTING") ? invariant() : void 0;
    const newState = {
      ...state,
      phase: "DROP_PENDING",
      isWaiting: true,
      reason
    };
    return newState;
  }
  if (action.type === "DROP_ANIMATE") {
    const {
      completed,
      dropDuration,
      newHomeClientOffset
    } = action.payload;
    !(state.phase === "DRAGGING" || state.phase === "DROP_PENDING") ? invariant() : void 0;
    const result = {
      phase: "DROP_ANIMATING",
      completed,
      dropDuration,
      newHomeClientOffset,
      dimensions: state.dimensions
    };
    return result;
  }
  if (action.type === "DROP_COMPLETE") {
    const {
      completed
    } = action.payload;
    return {
      phase: "IDLE",
      completed,
      shouldFlush: false
    };
  }
  return state;
}, "reducer");
function guard(action, predicate) {
  return action instanceof Object && "type" in action && action.type === predicate;
}
__name(guard, "guard");
const beforeInitialCapture = /* @__PURE__ */ __name((args) => ({
  type: "BEFORE_INITIAL_CAPTURE",
  payload: args
}), "beforeInitialCapture");
const lift$1 = /* @__PURE__ */ __name((args) => ({
  type: "LIFT",
  payload: args
}), "lift$1");
const initialPublish = /* @__PURE__ */ __name((args) => ({
  type: "INITIAL_PUBLISH",
  payload: args
}), "initialPublish");
const publishWhileDragging = /* @__PURE__ */ __name((args) => ({
  type: "PUBLISH_WHILE_DRAGGING",
  payload: args
}), "publishWhileDragging");
const collectionStarting = /* @__PURE__ */ __name(() => ({
  type: "COLLECTION_STARTING",
  payload: null
}), "collectionStarting");
const updateDroppableScroll = /* @__PURE__ */ __name((args) => ({
  type: "UPDATE_DROPPABLE_SCROLL",
  payload: args
}), "updateDroppableScroll");
const updateDroppableIsEnabled = /* @__PURE__ */ __name((args) => ({
  type: "UPDATE_DROPPABLE_IS_ENABLED",
  payload: args
}), "updateDroppableIsEnabled");
const updateDroppableIsCombineEnabled = /* @__PURE__ */ __name((args) => ({
  type: "UPDATE_DROPPABLE_IS_COMBINE_ENABLED",
  payload: args
}), "updateDroppableIsCombineEnabled");
const move = /* @__PURE__ */ __name((args) => ({
  type: "MOVE",
  payload: args
}), "move");
const moveByWindowScroll = /* @__PURE__ */ __name((args) => ({
  type: "MOVE_BY_WINDOW_SCROLL",
  payload: args
}), "moveByWindowScroll");
const updateViewportMaxScroll = /* @__PURE__ */ __name((args) => ({
  type: "UPDATE_VIEWPORT_MAX_SCROLL",
  payload: args
}), "updateViewportMaxScroll");
const moveUp = /* @__PURE__ */ __name(() => ({
  type: "MOVE_UP",
  payload: null
}), "moveUp");
const moveDown = /* @__PURE__ */ __name(() => ({
  type: "MOVE_DOWN",
  payload: null
}), "moveDown");
const moveRight = /* @__PURE__ */ __name(() => ({
  type: "MOVE_RIGHT",
  payload: null
}), "moveRight");
const moveLeft = /* @__PURE__ */ __name(() => ({
  type: "MOVE_LEFT",
  payload: null
}), "moveLeft");
const flush = /* @__PURE__ */ __name(() => ({
  type: "FLUSH",
  payload: null
}), "flush");
const animateDrop = /* @__PURE__ */ __name((args) => ({
  type: "DROP_ANIMATE",
  payload: args
}), "animateDrop");
const completeDrop = /* @__PURE__ */ __name((args) => ({
  type: "DROP_COMPLETE",
  payload: args
}), "completeDrop");
const drop = /* @__PURE__ */ __name((args) => ({
  type: "DROP",
  payload: args
}), "drop");
const dropPending = /* @__PURE__ */ __name((args) => ({
  type: "DROP_PENDING",
  payload: args
}), "dropPending");
const dropAnimationFinished = /* @__PURE__ */ __name(() => ({
  type: "DROP_ANIMATION_FINISHED",
  payload: null
}), "dropAnimationFinished");
var lift = /* @__PURE__ */ __name((marshal) => ({
  getState,
  dispatch
}) => (next) => (action) => {
  if (!guard(action, "LIFT")) {
    next(action);
    return;
  }
  const {
    id,
    clientSelection,
    movementMode
  } = action.payload;
  const initial = getState();
  if (initial.phase === "DROP_ANIMATING") {
    dispatch(completeDrop({
      completed: initial.completed
    }));
  }
  !(getState().phase === "IDLE") ? invariant() : void 0;
  dispatch(flush());
  dispatch(beforeInitialCapture({
    draggableId: id,
    movementMode
  }));
  const scrollOptions = {
    shouldPublishImmediately: movementMode === "SNAP"
  };
  const request = {
    draggableId: id,
    scrollOptions
  };
  const {
    critical,
    dimensions,
    viewport
  } = marshal.startPublishing(request);
  dispatch(initialPublish({
    critical,
    dimensions,
    clientSelection,
    movementMode,
    viewport
  }));
}, "lift");
var style = /* @__PURE__ */ __name((marshal) => () => (next) => (action) => {
  if (guard(action, "INITIAL_PUBLISH")) {
    marshal.dragging();
  }
  if (guard(action, "DROP_ANIMATE")) {
    marshal.dropping(action.payload.completed.result.reason);
  }
  if (guard(action, "FLUSH") || guard(action, "DROP_COMPLETE")) {
    marshal.resting();
  }
  next(action);
}, "style");
const curves = {
  outOfTheWay: "cubic-bezier(0.2, 0, 0, 1)",
  drop: "cubic-bezier(.2,1,.1,1)"
};
const combine = {
  opacity: {
    drop: 0,
    combining: 0.7
  },
  scale: {
    drop: 0.75
  }
};
const timings = {
  outOfTheWay: 0.2,
  minDropTime: 0.33,
  maxDropTime: 0.55
};
const outOfTheWayTiming = `${timings.outOfTheWay}s ${curves.outOfTheWay}`;
const transitions = {
  fluid: `opacity ${outOfTheWayTiming}`,
  snap: `transform ${outOfTheWayTiming}, opacity ${outOfTheWayTiming}`,
  drop: /* @__PURE__ */ __name((duration) => {
    const timing = `${duration}s ${curves.drop}`;
    return `transform ${timing}, opacity ${timing}`;
  }, "drop"),
  outOfTheWay: `transform ${outOfTheWayTiming}`,
  placeholder: `height ${outOfTheWayTiming}, width ${outOfTheWayTiming}, margin ${outOfTheWayTiming}`
};
const moveTo = /* @__PURE__ */ __name((offset22) => isEqual$1(offset22, origin) ? void 0 : `translate(${offset22.x}px, ${offset22.y}px)`, "moveTo");
const transforms = {
  moveTo,
  drop: /* @__PURE__ */ __name((offset22, isCombining) => {
    const translate = moveTo(offset22);
    if (!translate) {
      return void 0;
    }
    if (!isCombining) {
      return translate;
    }
    return `${translate} scale(${combine.scale.drop})`;
  }, "drop")
};
const {
  minDropTime,
  maxDropTime
} = timings;
const dropTimeRange = maxDropTime - minDropTime;
const maxDropTimeAtDistance = 1500;
const cancelDropModifier = 0.6;
var getDropDuration = /* @__PURE__ */ __name(({
  current,
  destination,
  reason
}) => {
  const distance$1 = distance(current, destination);
  if (distance$1 <= 0) {
    return minDropTime;
  }
  if (distance$1 >= maxDropTimeAtDistance) {
    return maxDropTime;
  }
  const percentage = distance$1 / maxDropTimeAtDistance;
  const duration = minDropTime + dropTimeRange * percentage;
  const withDuration = reason === "CANCEL" ? duration * cancelDropModifier : duration;
  return Number(withDuration.toFixed(2));
}, "getDropDuration");
var getNewHomeClientOffset = /* @__PURE__ */ __name(({
  impact,
  draggable: draggable2,
  dimensions,
  viewport,
  afterCritical
}) => {
  const {
    draggables,
    droppables
  } = dimensions;
  const droppableId = whatIsDraggedOver(impact);
  const destination = droppableId ? droppables[droppableId] : null;
  const home2 = droppables[draggable2.descriptor.droppableId];
  const newClientCenter = getClientBorderBoxCenter({
    impact,
    draggable: draggable2,
    draggables,
    afterCritical,
    droppable: destination || home2,
    viewport
  });
  const offset22 = subtract(newClientCenter, draggable2.client.borderBox.center);
  return offset22;
}, "getNewHomeClientOffset");
var getDropImpact = /* @__PURE__ */ __name(({
  draggables,
  reason,
  lastImpact,
  home: home2,
  viewport,
  onLiftImpact
}) => {
  if (!lastImpact.at || reason !== "DROP") {
    const recomputedHomeImpact = recompute({
      draggables,
      impact: onLiftImpact,
      destination: home2,
      viewport,
      forceShouldAnimate: true
    });
    return {
      impact: recomputedHomeImpact,
      didDropInsideDroppable: false
    };
  }
  if (lastImpact.at.type === "REORDER") {
    return {
      impact: lastImpact,
      didDropInsideDroppable: true
    };
  }
  const withoutMovement = {
    ...lastImpact,
    displaced: emptyGroups
  };
  return {
    impact: withoutMovement,
    didDropInsideDroppable: true
  };
}, "getDropImpact");
const dropMiddleware = /* @__PURE__ */ __name(({
  getState,
  dispatch
}) => (next) => (action) => {
  if (!guard(action, "DROP")) {
    next(action);
    return;
  }
  const state = getState();
  const reason = action.payload.reason;
  if (state.phase === "COLLECTING") {
    dispatch(dropPending({
      reason
    }));
    return;
  }
  if (state.phase === "IDLE") {
    return;
  }
  const isWaitingForDrop = state.phase === "DROP_PENDING" && state.isWaiting;
  !!isWaitingForDrop ? invariant() : void 0;
  !(state.phase === "DRAGGING" || state.phase === "DROP_PENDING") ? invariant() : void 0;
  const critical = state.critical;
  const dimensions = state.dimensions;
  const draggable2 = dimensions.draggables[state.critical.draggable.id];
  const {
    impact,
    didDropInsideDroppable
  } = getDropImpact({
    reason,
    lastImpact: state.impact,
    afterCritical: state.afterCritical,
    onLiftImpact: state.onLiftImpact,
    home: state.dimensions.droppables[state.critical.droppable.id],
    viewport: state.viewport,
    draggables: state.dimensions.draggables
  });
  const destination = didDropInsideDroppable ? tryGetDestination(impact) : null;
  const combine2 = didDropInsideDroppable ? tryGetCombine(impact) : null;
  const source = {
    index: critical.draggable.index,
    droppableId: critical.droppable.id
  };
  const result = {
    draggableId: draggable2.descriptor.id,
    type: draggable2.descriptor.type,
    source,
    reason,
    mode: state.movementMode,
    destination,
    combine: combine2
  };
  const newHomeClientOffset = getNewHomeClientOffset({
    impact,
    draggable: draggable2,
    dimensions,
    viewport: state.viewport,
    afterCritical: state.afterCritical
  });
  const completed = {
    critical: state.critical,
    afterCritical: state.afterCritical,
    result,
    impact
  };
  const isAnimationRequired = !isEqual$1(state.current.client.offset, newHomeClientOffset) || Boolean(result.combine);
  if (!isAnimationRequired) {
    dispatch(completeDrop({
      completed
    }));
    return;
  }
  const dropDuration = getDropDuration({
    current: state.current.client.offset,
    destination: newHomeClientOffset,
    reason
  });
  const args = {
    newHomeClientOffset,
    dropDuration,
    completed
  };
  dispatch(animateDrop(args));
}, "dropMiddleware");
var getWindowScroll = /* @__PURE__ */ __name(() => ({
  x: window.pageXOffset,
  y: window.pageYOffset
}), "getWindowScroll");
function getWindowScrollBinding(update2) {
  return {
    eventName: "scroll",
    options: {
      passive: true,
      capture: false
    },
    fn: /* @__PURE__ */ __name((event) => {
      if (event.target !== window && event.target !== window.document) {
        return;
      }
      update2();
    }, "fn")
  };
}
__name(getWindowScrollBinding, "getWindowScrollBinding");
function getScrollListener({
  onWindowScroll
}) {
  function updateScroll() {
    onWindowScroll(getWindowScroll());
  }
  __name(updateScroll, "updateScroll");
  const scheduled = rafSchd(updateScroll);
  const binding = getWindowScrollBinding(scheduled);
  let unbind = noop$2;
  function isActive2() {
    return unbind !== noop$2;
  }
  __name(isActive2, "isActive2");
  function start2() {
    !!isActive2() ? invariant() : void 0;
    unbind = bindEvents(window, [binding]);
  }
  __name(start2, "start2");
  function stop() {
    !isActive2() ? invariant() : void 0;
    scheduled.cancel();
    unbind();
    unbind = noop$2;
  }
  __name(stop, "stop");
  return {
    start: start2,
    stop,
    isActive: isActive2
  };
}
__name(getScrollListener, "getScrollListener");
const shouldStop$1 = /* @__PURE__ */ __name((action) => guard(action, "DROP_COMPLETE") || guard(action, "DROP_ANIMATE") || guard(action, "FLUSH"), "shouldStop$1");
const scrollListener = /* @__PURE__ */ __name((store) => {
  const listener = getScrollListener({
    onWindowScroll: /* @__PURE__ */ __name((newScroll) => {
      store.dispatch(moveByWindowScroll({
        newScroll
      }));
    }, "onWindowScroll")
  });
  return (next) => (action) => {
    if (!listener.isActive() && guard(action, "INITIAL_PUBLISH")) {
      listener.start();
    }
    if (listener.isActive() && shouldStop$1(action)) {
      listener.stop();
    }
    next(action);
  };
}, "scrollListener");
var getExpiringAnnounce = /* @__PURE__ */ __name((announce) => {
  let wasCalled = false;
  let isExpired = false;
  const timeoutId = setTimeout(() => {
    isExpired = true;
  });
  const result = /* @__PURE__ */ __name((message) => {
    if (wasCalled) {
      return;
    }
    if (isExpired) {
      return;
    }
    wasCalled = true;
    announce(message);
    clearTimeout(timeoutId);
  }, "result");
  result.wasCalled = () => wasCalled;
  return result;
}, "getExpiringAnnounce");
var getAsyncMarshal = /* @__PURE__ */ __name(() => {
  const entries = [];
  const execute2 = /* @__PURE__ */ __name((timerId) => {
    const index = entries.findIndex((item) => item.timerId === timerId);
    !(index !== -1) ? invariant() : void 0;
    const [entry] = entries.splice(index, 1);
    entry.callback();
  }, "execute2");
  const add2 = /* @__PURE__ */ __name((fn) => {
    const timerId = setTimeout(() => execute2(timerId));
    const entry = {
      timerId,
      callback: fn
    };
    entries.push(entry);
  }, "add2");
  const flush2 = /* @__PURE__ */ __name(() => {
    if (!entries.length) {
      return;
    }
    const shallow = [...entries];
    entries.length = 0;
    shallow.forEach((entry) => {
      clearTimeout(entry.timerId);
      entry.callback();
    });
  }, "flush2");
  return {
    add: add2,
    flush: flush2
  };
}, "getAsyncMarshal");
const areLocationsEqual = /* @__PURE__ */ __name((first, second) => {
  if (first == null && second == null) {
    return true;
  }
  if (first == null || second == null) {
    return false;
  }
  return first.droppableId === second.droppableId && first.index === second.index;
}, "areLocationsEqual");
const isCombineEqual = /* @__PURE__ */ __name((first, second) => {
  if (first == null && second == null) {
    return true;
  }
  if (first == null || second == null) {
    return false;
  }
  return first.draggableId === second.draggableId && first.droppableId === second.droppableId;
}, "isCombineEqual");
const isCriticalEqual = /* @__PURE__ */ __name((first, second) => {
  if (first === second) {
    return true;
  }
  const isDraggableEqual = first.draggable.id === second.draggable.id && first.draggable.droppableId === second.draggable.droppableId && first.draggable.type === second.draggable.type && first.draggable.index === second.draggable.index;
  const isDroppableEqual = first.droppable.id === second.droppable.id && first.droppable.type === second.droppable.type;
  return isDraggableEqual && isDroppableEqual;
}, "isCriticalEqual");
const withTimings = /* @__PURE__ */ __name((key, fn) => {
  fn();
}, "withTimings");
const getDragStart = /* @__PURE__ */ __name((critical, mode) => ({
  draggableId: critical.draggable.id,
  type: critical.droppable.type,
  source: {
    droppableId: critical.droppable.id,
    index: critical.draggable.index
  },
  mode
}), "getDragStart");
function execute(responder, data, announce, getDefaultMessage) {
  if (!responder) {
    announce(getDefaultMessage(data));
    return;
  }
  const willExpire = getExpiringAnnounce(announce);
  const provided = {
    announce: willExpire
  };
  responder(data, provided);
  if (!willExpire.wasCalled()) {
    announce(getDefaultMessage(data));
  }
}
__name(execute, "execute");
var getPublisher = /* @__PURE__ */ __name((getResponders, announce) => {
  const asyncMarshal = getAsyncMarshal();
  let dragging = null;
  const beforeCapture = /* @__PURE__ */ __name((draggableId, mode) => {
    !!dragging ? invariant() : void 0;
    withTimings("onBeforeCapture", () => {
      const fn = getResponders().onBeforeCapture;
      if (fn) {
        const before = {
          draggableId,
          mode
        };
        fn(before);
      }
    });
  }, "beforeCapture");
  const beforeStart = /* @__PURE__ */ __name((critical, mode) => {
    !!dragging ? invariant() : void 0;
    withTimings("onBeforeDragStart", () => {
      const fn = getResponders().onBeforeDragStart;
      if (fn) {
        fn(getDragStart(critical, mode));
      }
    });
  }, "beforeStart");
  const start2 = /* @__PURE__ */ __name((critical, mode) => {
    !!dragging ? invariant() : void 0;
    const data = getDragStart(critical, mode);
    dragging = {
      mode,
      lastCritical: critical,
      lastLocation: data.source,
      lastCombine: null
    };
    asyncMarshal.add(() => {
      withTimings("onDragStart", () => execute(getResponders().onDragStart, data, announce, preset.onDragStart));
    });
  }, "start2");
  const update2 = /* @__PURE__ */ __name((critical, impact) => {
    const location = tryGetDestination(impact);
    const combine2 = tryGetCombine(impact);
    !dragging ? invariant() : void 0;
    const hasCriticalChanged = !isCriticalEqual(critical, dragging.lastCritical);
    if (hasCriticalChanged) {
      dragging.lastCritical = critical;
    }
    const hasLocationChanged = !areLocationsEqual(dragging.lastLocation, location);
    if (hasLocationChanged) {
      dragging.lastLocation = location;
    }
    const hasGroupingChanged = !isCombineEqual(dragging.lastCombine, combine2);
    if (hasGroupingChanged) {
      dragging.lastCombine = combine2;
    }
    if (!hasCriticalChanged && !hasLocationChanged && !hasGroupingChanged) {
      return;
    }
    const data = {
      ...getDragStart(critical, dragging.mode),
      combine: combine2,
      destination: location
    };
    asyncMarshal.add(() => {
      withTimings("onDragUpdate", () => execute(getResponders().onDragUpdate, data, announce, preset.onDragUpdate));
    });
  }, "update2");
  const flush2 = /* @__PURE__ */ __name(() => {
    !dragging ? invariant() : void 0;
    asyncMarshal.flush();
  }, "flush2");
  const drop2 = /* @__PURE__ */ __name((result) => {
    !dragging ? invariant() : void 0;
    dragging = null;
    withTimings("onDragEnd", () => execute(getResponders().onDragEnd, result, announce, preset.onDragEnd));
  }, "drop2");
  const abort = /* @__PURE__ */ __name(() => {
    if (!dragging) {
      return;
    }
    const result = {
      ...getDragStart(dragging.lastCritical, dragging.mode),
      combine: null,
      destination: null,
      reason: "CANCEL"
    };
    drop2(result);
  }, "abort");
  return {
    beforeCapture,
    beforeStart,
    start: start2,
    update: update2,
    flush: flush2,
    drop: drop2,
    abort
  };
}, "getPublisher");
var responders = /* @__PURE__ */ __name((getResponders, announce) => {
  const publisher = getPublisher(getResponders, announce);
  return (store) => (next) => (action) => {
    if (guard(action, "BEFORE_INITIAL_CAPTURE")) {
      publisher.beforeCapture(action.payload.draggableId, action.payload.movementMode);
      return;
    }
    if (guard(action, "INITIAL_PUBLISH")) {
      const critical = action.payload.critical;
      publisher.beforeStart(critical, action.payload.movementMode);
      next(action);
      publisher.start(critical, action.payload.movementMode);
      return;
    }
    if (guard(action, "DROP_COMPLETE")) {
      const result = action.payload.completed.result;
      publisher.flush();
      next(action);
      publisher.drop(result);
      return;
    }
    next(action);
    if (guard(action, "FLUSH")) {
      publisher.abort();
      return;
    }
    const state = store.getState();
    if (state.phase === "DRAGGING") {
      publisher.update(state.critical, state.impact);
    }
  };
}, "responders");
const dropAnimationFinishMiddleware = /* @__PURE__ */ __name((store) => (next) => (action) => {
  if (!guard(action, "DROP_ANIMATION_FINISHED")) {
    next(action);
    return;
  }
  const state = store.getState();
  !(state.phase === "DROP_ANIMATING") ? invariant() : void 0;
  store.dispatch(completeDrop({
    completed: state.completed
  }));
}, "dropAnimationFinishMiddleware");
const dropAnimationFlushOnScrollMiddleware = /* @__PURE__ */ __name((store) => {
  let unbind = null;
  let frameId = null;
  function clear() {
    if (frameId) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
    if (unbind) {
      unbind();
      unbind = null;
    }
  }
  __name(clear, "clear");
  return (next) => (action) => {
    if (guard(action, "FLUSH") || guard(action, "DROP_COMPLETE") || guard(action, "DROP_ANIMATION_FINISHED")) {
      clear();
    }
    next(action);
    if (!guard(action, "DROP_ANIMATE")) {
      return;
    }
    const binding = {
      eventName: "scroll",
      options: {
        capture: true,
        passive: false,
        once: true
      },
      fn: /* @__PURE__ */ __name(function flushDropAnimation() {
        const state = store.getState();
        if (state.phase === "DROP_ANIMATING") {
          store.dispatch(dropAnimationFinished());
        }
      }, "flushDropAnimation")
    };
    frameId = requestAnimationFrame(() => {
      frameId = null;
      unbind = bindEvents(window, [binding]);
    });
  };
}, "dropAnimationFlushOnScrollMiddleware");
var dimensionMarshalStopper = /* @__PURE__ */ __name((marshal) => () => (next) => (action) => {
  if (guard(action, "DROP_COMPLETE") || guard(action, "FLUSH") || guard(action, "DROP_ANIMATE")) {
    marshal.stopPublishing();
  }
  next(action);
}, "dimensionMarshalStopper");
var focus = /* @__PURE__ */ __name((marshal) => {
  let isWatching = false;
  return () => (next) => (action) => {
    if (guard(action, "INITIAL_PUBLISH")) {
      isWatching = true;
      marshal.tryRecordFocus(action.payload.critical.draggable.id);
      next(action);
      marshal.tryRestoreFocusRecorded();
      return;
    }
    next(action);
    if (!isWatching) {
      return;
    }
    if (guard(action, "FLUSH")) {
      isWatching = false;
      marshal.tryRestoreFocusRecorded();
      return;
    }
    if (guard(action, "DROP_COMPLETE")) {
      isWatching = false;
      const result = action.payload.completed.result;
      if (result.combine) {
        marshal.tryShiftRecord(result.draggableId, result.combine.draggableId);
      }
      marshal.tryRestoreFocusRecorded();
    }
  };
}, "focus");
const shouldStop = /* @__PURE__ */ __name((action) => guard(action, "DROP_COMPLETE") || guard(action, "DROP_ANIMATE") || guard(action, "FLUSH"), "shouldStop");
var autoScroll = /* @__PURE__ */ __name((autoScroller) => (store) => (next) => (action) => {
  if (shouldStop(action)) {
    autoScroller.stop();
    next(action);
    return;
  }
  if (guard(action, "INITIAL_PUBLISH")) {
    next(action);
    const state = store.getState();
    !(state.phase === "DRAGGING") ? invariant() : void 0;
    autoScroller.start(state);
    return;
  }
  next(action);
  autoScroller.scroll(store.getState());
}, "autoScroll");
const pendingDrop = /* @__PURE__ */ __name((store) => (next) => (action) => {
  next(action);
  if (!guard(action, "PUBLISH_WHILE_DRAGGING")) {
    return;
  }
  const postActionState = store.getState();
  if (postActionState.phase !== "DROP_PENDING") {
    return;
  }
  if (postActionState.isWaiting) {
    return;
  }
  store.dispatch(drop({
    reason: postActionState.reason
  }));
}, "pendingDrop");
const composeEnhancers = compose;
var createStore = /* @__PURE__ */ __name(({
  dimensionMarshal,
  focusMarshal,
  styleMarshal,
  getResponders,
  announce,
  autoScroller
}) => createStore$1(reducer, composeEnhancers(applyMiddleware(style(styleMarshal), dimensionMarshalStopper(dimensionMarshal), lift(dimensionMarshal), dropMiddleware, dropAnimationFinishMiddleware, dropAnimationFlushOnScrollMiddleware, pendingDrop, autoScroll(autoScroller), scrollListener, focus(focusMarshal), responders(getResponders, announce)))), "createStore");
const clean$1 = /* @__PURE__ */ __name(() => ({
  additions: {},
  removals: {},
  modified: {}
}), "clean$1");
function createPublisher({
  registry,
  callbacks
}) {
  let staging = clean$1();
  let frameId = null;
  const collect = /* @__PURE__ */ __name(() => {
    if (frameId) {
      return;
    }
    callbacks.collectionStarting();
    frameId = requestAnimationFrame(() => {
      frameId = null;
      const {
        additions,
        removals,
        modified
      } = staging;
      const added = Object.keys(additions).map((id) => registry.draggable.getById(id).getDimension(origin)).sort((a, b) => a.descriptor.index - b.descriptor.index);
      const updated = Object.keys(modified).map((id) => {
        const entry = registry.droppable.getById(id);
        const scroll2 = entry.callbacks.getScrollWhileDragging();
        return {
          droppableId: id,
          scroll: scroll2
        };
      });
      const result = {
        additions: added,
        removals: Object.keys(removals),
        modified: updated
      };
      staging = clean$1();
      callbacks.publish(result);
    });
  }, "collect");
  const add2 = /* @__PURE__ */ __name((entry) => {
    const id = entry.descriptor.id;
    staging.additions[id] = entry;
    staging.modified[entry.descriptor.droppableId] = true;
    if (staging.removals[id]) {
      delete staging.removals[id];
    }
    collect();
  }, "add2");
  const remove = /* @__PURE__ */ __name((entry) => {
    const descriptor = entry.descriptor;
    staging.removals[descriptor.id] = true;
    staging.modified[descriptor.droppableId] = true;
    if (staging.additions[descriptor.id]) {
      delete staging.additions[descriptor.id];
    }
    collect();
  }, "remove");
  const stop = /* @__PURE__ */ __name(() => {
    if (!frameId) {
      return;
    }
    cancelAnimationFrame(frameId);
    frameId = null;
    staging = clean$1();
  }, "stop");
  return {
    add: add2,
    remove,
    stop
  };
}
__name(createPublisher, "createPublisher");
var getMaxScroll = /* @__PURE__ */ __name(({
  scrollHeight,
  scrollWidth,
  height,
  width
}) => {
  const maxScroll = subtract({
    x: scrollWidth,
    y: scrollHeight
  }, {
    x: width,
    y: height
  });
  const adjustedMaxScroll = {
    x: Math.max(0, maxScroll.x),
    y: Math.max(0, maxScroll.y)
  };
  return adjustedMaxScroll;
}, "getMaxScroll");
var getDocumentElement = /* @__PURE__ */ __name(() => {
  const doc = document.documentElement;
  !doc ? invariant() : void 0;
  return doc;
}, "getDocumentElement");
var getMaxWindowScroll = /* @__PURE__ */ __name(() => {
  const doc = getDocumentElement();
  const maxScroll = getMaxScroll({
    scrollHeight: doc.scrollHeight,
    scrollWidth: doc.scrollWidth,
    width: doc.clientWidth,
    height: doc.clientHeight
  });
  return maxScroll;
}, "getMaxWindowScroll");
var getViewport = /* @__PURE__ */ __name(() => {
  const scroll2 = getWindowScroll();
  const maxScroll = getMaxWindowScroll();
  const top = scroll2.y;
  const left = scroll2.x;
  const doc = getDocumentElement();
  const width = doc.clientWidth;
  const height = doc.clientHeight;
  const right = left + width;
  const bottom = top + height;
  const frame = getRect({
    top,
    left,
    right,
    bottom
  });
  const viewport = {
    frame,
    scroll: {
      initial: scroll2,
      current: scroll2,
      max: maxScroll,
      diff: {
        value: origin,
        displacement: origin
      }
    }
  };
  return viewport;
}, "getViewport");
var getInitialPublish = /* @__PURE__ */ __name(({
  critical,
  scrollOptions,
  registry
}) => {
  const viewport = getViewport();
  const windowScroll = viewport.scroll.current;
  const home2 = critical.droppable;
  const droppables = registry.droppable.getAllByType(home2.type).map((entry) => entry.callbacks.getDimensionAndWatchScroll(windowScroll, scrollOptions));
  const draggables = registry.draggable.getAllByType(critical.draggable.type).map((entry) => entry.getDimension(windowScroll));
  const dimensions = {
    draggables: toDraggableMap(draggables),
    droppables: toDroppableMap(droppables)
  };
  const result = {
    dimensions,
    critical,
    viewport
  };
  return result;
}, "getInitialPublish");
function shouldPublishUpdate(registry, dragging, entry) {
  if (entry.descriptor.id === dragging.id) {
    return false;
  }
  if (entry.descriptor.type !== dragging.type) {
    return false;
  }
  const home2 = registry.droppable.getById(entry.descriptor.droppableId);
  if (home2.descriptor.mode !== "virtual") {
    return false;
  }
  return true;
}
__name(shouldPublishUpdate, "shouldPublishUpdate");
var createDimensionMarshal = /* @__PURE__ */ __name((registry, callbacks) => {
  let collection = null;
  const publisher = createPublisher({
    callbacks: {
      publish: callbacks.publishWhileDragging,
      collectionStarting: callbacks.collectionStarting
    },
    registry
  });
  const updateDroppableIsEnabled2 = /* @__PURE__ */ __name((id, isEnabled) => {
    !registry.droppable.exists(id) ? invariant() : void 0;
    if (!collection) {
      return;
    }
    callbacks.updateDroppableIsEnabled({
      id,
      isEnabled
    });
  }, "updateDroppableIsEnabled2");
  const updateDroppableIsCombineEnabled2 = /* @__PURE__ */ __name((id, isCombineEnabled) => {
    if (!collection) {
      return;
    }
    !registry.droppable.exists(id) ? invariant() : void 0;
    callbacks.updateDroppableIsCombineEnabled({
      id,
      isCombineEnabled
    });
  }, "updateDroppableIsCombineEnabled2");
  const updateDroppableScroll2 = /* @__PURE__ */ __name((id, newScroll) => {
    if (!collection) {
      return;
    }
    !registry.droppable.exists(id) ? invariant() : void 0;
    callbacks.updateDroppableScroll({
      id,
      newScroll
    });
  }, "updateDroppableScroll2");
  const scrollDroppable2 = /* @__PURE__ */ __name((id, change) => {
    if (!collection) {
      return;
    }
    registry.droppable.getById(id).callbacks.scroll(change);
  }, "scrollDroppable2");
  const stopPublishing = /* @__PURE__ */ __name(() => {
    if (!collection) {
      return;
    }
    publisher.stop();
    const home2 = collection.critical.droppable;
    registry.droppable.getAllByType(home2.type).forEach((entry) => entry.callbacks.dragStopped());
    collection.unsubscribe();
    collection = null;
  }, "stopPublishing");
  const subscriber = /* @__PURE__ */ __name((event) => {
    !collection ? invariant() : void 0;
    const dragging = collection.critical.draggable;
    if (event.type === "ADDITION") {
      if (shouldPublishUpdate(registry, dragging, event.value)) {
        publisher.add(event.value);
      }
    }
    if (event.type === "REMOVAL") {
      if (shouldPublishUpdate(registry, dragging, event.value)) {
        publisher.remove(event.value);
      }
    }
  }, "subscriber");
  const startPublishing = /* @__PURE__ */ __name((request) => {
    !!collection ? invariant() : void 0;
    const entry = registry.draggable.getById(request.draggableId);
    const home2 = registry.droppable.getById(entry.descriptor.droppableId);
    const critical = {
      draggable: entry.descriptor,
      droppable: home2.descriptor
    };
    const unsubscribe = registry.subscribe(subscriber);
    collection = {
      critical,
      unsubscribe
    };
    return getInitialPublish({
      critical,
      registry,
      scrollOptions: request.scrollOptions
    });
  }, "startPublishing");
  const marshal = {
    updateDroppableIsEnabled: updateDroppableIsEnabled2,
    updateDroppableIsCombineEnabled: updateDroppableIsCombineEnabled2,
    scrollDroppable: scrollDroppable2,
    updateDroppableScroll: updateDroppableScroll2,
    startPublishing,
    stopPublishing
  };
  return marshal;
}, "createDimensionMarshal");
var canStartDrag = /* @__PURE__ */ __name((state, id) => {
  if (state.phase === "IDLE") {
    return true;
  }
  if (state.phase !== "DROP_ANIMATING") {
    return false;
  }
  if (state.completed.result.draggableId === id) {
    return false;
  }
  return state.completed.result.reason === "DROP";
}, "canStartDrag");
var scrollWindow = /* @__PURE__ */ __name((change) => {
  window.scrollBy(change.x, change.y);
}, "scrollWindow");
const getScrollableDroppables = memoizeOne((droppables) => toDroppableList(droppables).filter((droppable2) => {
  if (!droppable2.isEnabled) {
    return false;
  }
  if (!droppable2.frame) {
    return false;
  }
  return true;
}));
const getScrollableDroppableOver = /* @__PURE__ */ __name((target, droppables) => {
  const maybe = getScrollableDroppables(droppables).find((droppable2) => {
    !droppable2.frame ? invariant() : void 0;
    return isPositionInFrame(droppable2.frame.pageMarginBox)(target);
  }) || null;
  return maybe;
}, "getScrollableDroppableOver");
var getBestScrollableDroppable = /* @__PURE__ */ __name(({
  center,
  destination,
  droppables
}) => {
  if (destination) {
    const dimension2 = droppables[destination];
    if (!dimension2.frame) {
      return null;
    }
    return dimension2;
  }
  const dimension = getScrollableDroppableOver(center, droppables);
  return dimension;
}, "getBestScrollableDroppable");
const defaultAutoScrollerOptions = {
  startFromPercentage: 0.25,
  maxScrollAtPercentage: 0.05,
  maxPixelScroll: 28,
  ease: /* @__PURE__ */ __name((percentage) => percentage ** 2, "ease"),
  durationDampening: {
    stopDampeningAt: 1200,
    accelerateAt: 360
  },
  disabled: false
};
var getDistanceThresholds = /* @__PURE__ */ __name((container, axis, getAutoScrollerOptions = () => defaultAutoScrollerOptions) => {
  const autoScrollerOptions = getAutoScrollerOptions();
  const startScrollingFrom = container[axis.size] * autoScrollerOptions.startFromPercentage;
  const maxScrollValueAt = container[axis.size] * autoScrollerOptions.maxScrollAtPercentage;
  const thresholds = {
    startScrollingFrom,
    maxScrollValueAt
  };
  return thresholds;
}, "getDistanceThresholds");
var getPercentage = /* @__PURE__ */ __name(({
  startOfRange,
  endOfRange,
  current
}) => {
  const range = endOfRange - startOfRange;
  if (range === 0) {
    return 0;
  }
  const currentInRange = current - startOfRange;
  const percentage = currentInRange / range;
  return percentage;
}, "getPercentage");
var minScroll = 1;
var getValueFromDistance = /* @__PURE__ */ __name((distanceToEdge, thresholds, getAutoScrollerOptions = () => defaultAutoScrollerOptions) => {
  const autoScrollerOptions = getAutoScrollerOptions();
  if (distanceToEdge > thresholds.startScrollingFrom) {
    return 0;
  }
  if (distanceToEdge <= thresholds.maxScrollValueAt) {
    return autoScrollerOptions.maxPixelScroll;
  }
  if (distanceToEdge === thresholds.startScrollingFrom) {
    return minScroll;
  }
  const percentageFromMaxScrollValueAt = getPercentage({
    startOfRange: thresholds.maxScrollValueAt,
    endOfRange: thresholds.startScrollingFrom,
    current: distanceToEdge
  });
  const percentageFromStartScrollingFrom = 1 - percentageFromMaxScrollValueAt;
  const scroll2 = autoScrollerOptions.maxPixelScroll * autoScrollerOptions.ease(percentageFromStartScrollingFrom);
  return Math.ceil(scroll2);
}, "getValueFromDistance");
var dampenValueByTime = /* @__PURE__ */ __name((proposedScroll, dragStartTime, getAutoScrollerOptions) => {
  const autoScrollerOptions = getAutoScrollerOptions();
  const accelerateAt = autoScrollerOptions.durationDampening.accelerateAt;
  const stopAt = autoScrollerOptions.durationDampening.stopDampeningAt;
  const startOfRange = dragStartTime;
  const endOfRange = stopAt;
  const now = Date.now();
  const runTime = now - startOfRange;
  if (runTime >= stopAt) {
    return proposedScroll;
  }
  if (runTime < accelerateAt) {
    return minScroll;
  }
  const betweenAccelerateAtAndStopAtPercentage = getPercentage({
    startOfRange: accelerateAt,
    endOfRange,
    current: runTime
  });
  const scroll2 = proposedScroll * autoScrollerOptions.ease(betweenAccelerateAtAndStopAtPercentage);
  return Math.ceil(scroll2);
}, "dampenValueByTime");
var getValue = /* @__PURE__ */ __name(({
  distanceToEdge,
  thresholds,
  dragStartTime,
  shouldUseTimeDampening,
  getAutoScrollerOptions
}) => {
  const scroll2 = getValueFromDistance(distanceToEdge, thresholds, getAutoScrollerOptions);
  if (scroll2 === 0) {
    return 0;
  }
  if (!shouldUseTimeDampening) {
    return scroll2;
  }
  return Math.max(dampenValueByTime(scroll2, dragStartTime, getAutoScrollerOptions), minScroll);
}, "getValue");
var getScrollOnAxis = /* @__PURE__ */ __name(({
  container,
  distanceToEdges,
  dragStartTime,
  axis,
  shouldUseTimeDampening,
  getAutoScrollerOptions
}) => {
  const thresholds = getDistanceThresholds(container, axis, getAutoScrollerOptions);
  const isCloserToEnd = distanceToEdges[axis.end] < distanceToEdges[axis.start];
  if (isCloserToEnd) {
    return getValue({
      distanceToEdge: distanceToEdges[axis.end],
      thresholds,
      dragStartTime,
      shouldUseTimeDampening,
      getAutoScrollerOptions
    });
  }
  return -1 * getValue({
    distanceToEdge: distanceToEdges[axis.start],
    thresholds,
    dragStartTime,
    shouldUseTimeDampening,
    getAutoScrollerOptions
  });
}, "getScrollOnAxis");
var adjustForSizeLimits = /* @__PURE__ */ __name(({
  container,
  subject,
  proposedScroll
}) => {
  const isTooBigVertically = subject.height > container.height;
  const isTooBigHorizontally = subject.width > container.width;
  if (!isTooBigHorizontally && !isTooBigVertically) {
    return proposedScroll;
  }
  if (isTooBigHorizontally && isTooBigVertically) {
    return null;
  }
  return {
    x: isTooBigHorizontally ? 0 : proposedScroll.x,
    y: isTooBigVertically ? 0 : proposedScroll.y
  };
}, "adjustForSizeLimits");
const clean = apply((value) => value === 0 ? 0 : value);
var getScroll$1 = /* @__PURE__ */ __name(({
  dragStartTime,
  container,
  subject,
  center,
  shouldUseTimeDampening,
  getAutoScrollerOptions
}) => {
  const distanceToEdges = {
    top: center.y - container.top,
    right: container.right - center.x,
    bottom: container.bottom - center.y,
    left: center.x - container.left
  };
  const y = getScrollOnAxis({
    container,
    distanceToEdges,
    dragStartTime,
    axis: vertical,
    shouldUseTimeDampening,
    getAutoScrollerOptions
  });
  const x = getScrollOnAxis({
    container,
    distanceToEdges,
    dragStartTime,
    axis: horizontal,
    shouldUseTimeDampening,
    getAutoScrollerOptions
  });
  const required2 = clean({
    x,
    y
  });
  if (isEqual$1(required2, origin)) {
    return null;
  }
  const limited = adjustForSizeLimits({
    container,
    subject,
    proposedScroll: required2
  });
  if (!limited) {
    return null;
  }
  return isEqual$1(limited, origin) ? null : limited;
}, "getScroll$1");
const smallestSigned = apply((value) => {
  if (value === 0) {
    return 0;
  }
  return value > 0 ? 1 : -1;
});
const getOverlap = /* @__PURE__ */ (() => {
  const getRemainder = /* @__PURE__ */ __name((target, max) => {
    if (target < 0) {
      return target;
    }
    if (target > max) {
      return target - max;
    }
    return 0;
  }, "getRemainder");
  return ({
    current,
    max,
    change
  }) => {
    const targetScroll = add(current, change);
    const overlap = {
      x: getRemainder(targetScroll.x, max.x),
      y: getRemainder(targetScroll.y, max.y)
    };
    if (isEqual$1(overlap, origin)) {
      return null;
    }
    return overlap;
  };
})();
const canPartiallyScroll = /* @__PURE__ */ __name(({
  max: rawMax,
  current,
  change
}) => {
  const max = {
    x: Math.max(current.x, rawMax.x),
    y: Math.max(current.y, rawMax.y)
  };
  const smallestChange = smallestSigned(change);
  const overlap = getOverlap({
    max,
    current,
    change: smallestChange
  });
  if (!overlap) {
    return true;
  }
  if (smallestChange.x !== 0 && overlap.x === 0) {
    return true;
  }
  if (smallestChange.y !== 0 && overlap.y === 0) {
    return true;
  }
  return false;
}, "canPartiallyScroll");
const canScrollWindow = /* @__PURE__ */ __name((viewport, change) => canPartiallyScroll({
  current: viewport.scroll.current,
  max: viewport.scroll.max,
  change
}), "canScrollWindow");
const getWindowOverlap = /* @__PURE__ */ __name((viewport, change) => {
  if (!canScrollWindow(viewport, change)) {
    return null;
  }
  const max = viewport.scroll.max;
  const current = viewport.scroll.current;
  return getOverlap({
    current,
    max,
    change
  });
}, "getWindowOverlap");
const canScrollDroppable = /* @__PURE__ */ __name((droppable2, change) => {
  const frame = droppable2.frame;
  if (!frame) {
    return false;
  }
  return canPartiallyScroll({
    current: frame.scroll.current,
    max: frame.scroll.max,
    change
  });
}, "canScrollDroppable");
const getDroppableOverlap = /* @__PURE__ */ __name((droppable2, change) => {
  const frame = droppable2.frame;
  if (!frame) {
    return null;
  }
  if (!canScrollDroppable(droppable2, change)) {
    return null;
  }
  return getOverlap({
    current: frame.scroll.current,
    max: frame.scroll.max,
    change
  });
}, "getDroppableOverlap");
var getWindowScrollChange = /* @__PURE__ */ __name(({
  viewport,
  subject,
  center,
  dragStartTime,
  shouldUseTimeDampening,
  getAutoScrollerOptions
}) => {
  const scroll2 = getScroll$1({
    dragStartTime,
    container: viewport.frame,
    subject,
    center,
    shouldUseTimeDampening,
    getAutoScrollerOptions
  });
  return scroll2 && canScrollWindow(viewport, scroll2) ? scroll2 : null;
}, "getWindowScrollChange");
var getDroppableScrollChange = /* @__PURE__ */ __name(({
  droppable: droppable2,
  subject,
  center,
  dragStartTime,
  shouldUseTimeDampening,
  getAutoScrollerOptions
}) => {
  const frame = droppable2.frame;
  if (!frame) {
    return null;
  }
  const scroll2 = getScroll$1({
    dragStartTime,
    container: frame.pageMarginBox,
    subject,
    center,
    shouldUseTimeDampening,
    getAutoScrollerOptions
  });
  return scroll2 && canScrollDroppable(droppable2, scroll2) ? scroll2 : null;
}, "getDroppableScrollChange");
var scroll = /* @__PURE__ */ __name(({
  state,
  dragStartTime,
  shouldUseTimeDampening,
  scrollWindow: scrollWindow2,
  scrollDroppable: scrollDroppable2,
  getAutoScrollerOptions
}) => {
  const center = state.current.page.borderBoxCenter;
  const draggable2 = state.dimensions.draggables[state.critical.draggable.id];
  const subject = draggable2.page.marginBox;
  if (state.isWindowScrollAllowed) {
    const viewport = state.viewport;
    const change2 = getWindowScrollChange({
      dragStartTime,
      viewport,
      subject,
      center,
      shouldUseTimeDampening,
      getAutoScrollerOptions
    });
    if (change2) {
      scrollWindow2(change2);
      return;
    }
  }
  const droppable2 = getBestScrollableDroppable({
    center,
    destination: whatIsDraggedOver(state.impact),
    droppables: state.dimensions.droppables
  });
  if (!droppable2) {
    return;
  }
  const change = getDroppableScrollChange({
    dragStartTime,
    droppable: droppable2,
    subject,
    center,
    shouldUseTimeDampening,
    getAutoScrollerOptions
  });
  if (change) {
    scrollDroppable2(droppable2.descriptor.id, change);
  }
}, "scroll");
var createFluidScroller = /* @__PURE__ */ __name(({
  scrollWindow: scrollWindow2,
  scrollDroppable: scrollDroppable2,
  getAutoScrollerOptions = /* @__PURE__ */ __name(() => defaultAutoScrollerOptions, "getAutoScrollerOptions")
}) => {
  const scheduleWindowScroll = rafSchd(scrollWindow2);
  const scheduleDroppableScroll = rafSchd(scrollDroppable2);
  let dragging = null;
  const tryScroll = /* @__PURE__ */ __name((state) => {
    !dragging ? invariant() : void 0;
    const {
      shouldUseTimeDampening,
      dragStartTime
    } = dragging;
    scroll({
      state,
      scrollWindow: scheduleWindowScroll,
      scrollDroppable: scheduleDroppableScroll,
      dragStartTime,
      shouldUseTimeDampening,
      getAutoScrollerOptions
    });
  }, "tryScroll");
  const start$1 = /* @__PURE__ */ __name((state) => {
    !!dragging ? invariant() : void 0;
    const dragStartTime = Date.now();
    let wasScrollNeeded = false;
    const fakeScrollCallback = /* @__PURE__ */ __name(() => {
      wasScrollNeeded = true;
    }, "fakeScrollCallback");
    scroll({
      state,
      dragStartTime: 0,
      shouldUseTimeDampening: false,
      scrollWindow: fakeScrollCallback,
      scrollDroppable: fakeScrollCallback,
      getAutoScrollerOptions
    });
    dragging = {
      dragStartTime,
      shouldUseTimeDampening: wasScrollNeeded
    };
    if (wasScrollNeeded) {
      tryScroll(state);
    }
  }, "start$1");
  const stop = /* @__PURE__ */ __name(() => {
    if (!dragging) {
      return;
    }
    scheduleWindowScroll.cancel();
    scheduleDroppableScroll.cancel();
    dragging = null;
  }, "stop");
  return {
    start: start$1,
    stop,
    scroll: tryScroll
  };
}, "createFluidScroller");
var createJumpScroller = /* @__PURE__ */ __name(({
  move: move2,
  scrollDroppable: scrollDroppable2,
  scrollWindow: scrollWindow2
}) => {
  const moveByOffset = /* @__PURE__ */ __name((state, offset22) => {
    const client = add(state.current.client.selection, offset22);
    move2({
      client
    });
  }, "moveByOffset");
  const scrollDroppableAsMuchAsItCan = /* @__PURE__ */ __name((droppable2, change) => {
    if (!canScrollDroppable(droppable2, change)) {
      return change;
    }
    const overlap = getDroppableOverlap(droppable2, change);
    if (!overlap) {
      scrollDroppable2(droppable2.descriptor.id, change);
      return null;
    }
    const whatTheDroppableCanScroll = subtract(change, overlap);
    scrollDroppable2(droppable2.descriptor.id, whatTheDroppableCanScroll);
    const remainder = subtract(change, whatTheDroppableCanScroll);
    return remainder;
  }, "scrollDroppableAsMuchAsItCan");
  const scrollWindowAsMuchAsItCan = /* @__PURE__ */ __name((isWindowScrollAllowed, viewport, change) => {
    if (!isWindowScrollAllowed) {
      return change;
    }
    if (!canScrollWindow(viewport, change)) {
      return change;
    }
    const overlap = getWindowOverlap(viewport, change);
    if (!overlap) {
      scrollWindow2(change);
      return null;
    }
    const whatTheWindowCanScroll = subtract(change, overlap);
    scrollWindow2(whatTheWindowCanScroll);
    const remainder = subtract(change, whatTheWindowCanScroll);
    return remainder;
  }, "scrollWindowAsMuchAsItCan");
  const jumpScroller = /* @__PURE__ */ __name((state) => {
    const request = state.scrollJumpRequest;
    if (!request) {
      return;
    }
    const destination = whatIsDraggedOver(state.impact);
    !destination ? invariant() : void 0;
    const droppableRemainder = scrollDroppableAsMuchAsItCan(state.dimensions.droppables[destination], request);
    if (!droppableRemainder) {
      return;
    }
    const viewport = state.viewport;
    const windowRemainder = scrollWindowAsMuchAsItCan(state.isWindowScrollAllowed, viewport, droppableRemainder);
    if (!windowRemainder) {
      return;
    }
    moveByOffset(state, windowRemainder);
  }, "jumpScroller");
  return jumpScroller;
}, "createJumpScroller");
var createAutoScroller = /* @__PURE__ */ __name(({
  scrollDroppable: scrollDroppable2,
  scrollWindow: scrollWindow2,
  move: move2,
  getAutoScrollerOptions
}) => {
  const fluidScroller = createFluidScroller({
    scrollWindow: scrollWindow2,
    scrollDroppable: scrollDroppable2,
    getAutoScrollerOptions
  });
  const jumpScroll = createJumpScroller({
    move: move2,
    scrollWindow: scrollWindow2,
    scrollDroppable: scrollDroppable2
  });
  const scroll2 = /* @__PURE__ */ __name((state) => {
    const autoScrollerOptions = getAutoScrollerOptions();
    if (autoScrollerOptions.disabled || state.phase !== "DRAGGING") {
      return;
    }
    if (state.movementMode === "FLUID") {
      fluidScroller.scroll(state);
      return;
    }
    if (!state.scrollJumpRequest) {
      return;
    }
    jumpScroll(state);
  }, "scroll2");
  const scroller = {
    scroll: scroll2,
    start: fluidScroller.start,
    stop: fluidScroller.stop
  };
  return scroller;
}, "createAutoScroller");
const prefix = "data-rfd";
const dragHandle = (() => {
  const base = `${prefix}-drag-handle`;
  return {
    base,
    draggableId: `${base}-draggable-id`,
    contextId: `${base}-context-id`
  };
})();
const draggable = (() => {
  const base = `${prefix}-draggable`;
  return {
    base,
    contextId: `${base}-context-id`,
    id: `${base}-id`
  };
})();
const droppable = (() => {
  const base = `${prefix}-droppable`;
  return {
    base,
    contextId: `${base}-context-id`,
    id: `${base}-id`
  };
})();
const scrollContainer = {
  contextId: `${prefix}-scroll-container-context-id`
};
const makeGetSelector = /* @__PURE__ */ __name((context) => (attribute) => `[${attribute}="${context}"]`, "makeGetSelector");
const getStyles = /* @__PURE__ */ __name((rules, property) => rules.map((rule) => {
  const value = rule.styles[property];
  if (!value) {
    return "";
  }
  return `${rule.selector} { ${value} }`;
}).join(" "), "getStyles");
const noPointerEvents = "pointer-events: none;";
var getStyles$1 = /* @__PURE__ */ __name((contextId) => {
  const getSelector2 = makeGetSelector(contextId);
  const dragHandle$1 = (() => {
    const grabCursor = `
      cursor: -webkit-grab;
      cursor: grab;
    `;
    return {
      selector: getSelector2(dragHandle.contextId),
      styles: {
        always: `
          -webkit-touch-callout: none;
          -webkit-tap-highlight-color: rgba(0,0,0,0);
          touch-action: manipulation;
        `,
        resting: grabCursor,
        dragging: noPointerEvents,
        dropAnimating: grabCursor
      }
    };
  })();
  const draggable$1 = (() => {
    const transition = `
      transition: ${transitions.outOfTheWay};
    `;
    return {
      selector: getSelector2(draggable.contextId),
      styles: {
        dragging: transition,
        dropAnimating: transition,
        userCancel: transition
      }
    };
  })();
  const droppable$1 = {
    selector: getSelector2(droppable.contextId),
    styles: {
      always: `overflow-anchor: none;`
    }
  };
  const body = {
    selector: "body",
    styles: {
      dragging: `
        cursor: grabbing;
        cursor: -webkit-grabbing;
        user-select: none;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        overflow-anchor: none;
      `
    }
  };
  const rules = [draggable$1, dragHandle$1, droppable$1, body];
  return {
    always: getStyles(rules, "always"),
    resting: getStyles(rules, "resting"),
    dragging: getStyles(rules, "dragging"),
    dropAnimating: getStyles(rules, "dropAnimating"),
    userCancel: getStyles(rules, "userCancel")
  };
}, "getStyles$1");
const useIsomorphicLayoutEffect = typeof window !== "undefined" && typeof window.document !== "undefined" && typeof window.document.createElement !== "undefined" ? reactExports.useLayoutEffect : reactExports.useEffect;
const getHead = /* @__PURE__ */ __name(() => {
  const head = document.querySelector("head");
  !head ? invariant() : void 0;
  return head;
}, "getHead");
const createStyleEl = /* @__PURE__ */ __name((nonce) => {
  const el = document.createElement("style");
  if (nonce) {
    el.setAttribute("nonce", nonce);
  }
  el.type = "text/css";
  return el;
}, "createStyleEl");
function useStyleMarshal(contextId, nonce) {
  const styles = useMemo(() => getStyles$1(contextId), [contextId]);
  const alwaysRef = reactExports.useRef(null);
  const dynamicRef = reactExports.useRef(null);
  const setDynamicStyle = useCallback(memoizeOne((proposed) => {
    const el = dynamicRef.current;
    !el ? invariant() : void 0;
    el.textContent = proposed;
  }), []);
  const setAlwaysStyle = useCallback((proposed) => {
    const el = alwaysRef.current;
    !el ? invariant() : void 0;
    el.textContent = proposed;
  }, []);
  useIsomorphicLayoutEffect(() => {
    !(!alwaysRef.current && !dynamicRef.current) ? invariant() : void 0;
    const always = createStyleEl(nonce);
    const dynamic = createStyleEl(nonce);
    alwaysRef.current = always;
    dynamicRef.current = dynamic;
    always.setAttribute(`${prefix}-always`, contextId);
    dynamic.setAttribute(`${prefix}-dynamic`, contextId);
    getHead().appendChild(always);
    getHead().appendChild(dynamic);
    setAlwaysStyle(styles.always);
    setDynamicStyle(styles.resting);
    return () => {
      const remove = /* @__PURE__ */ __name((ref2) => {
        const current = ref2.current;
        !current ? invariant() : void 0;
        getHead().removeChild(current);
        ref2.current = null;
      }, "remove");
      remove(alwaysRef);
      remove(dynamicRef);
    };
  }, [nonce, setAlwaysStyle, setDynamicStyle, styles.always, styles.resting, contextId]);
  const dragging = useCallback(() => setDynamicStyle(styles.dragging), [setDynamicStyle, styles.dragging]);
  const dropping = useCallback((reason) => {
    if (reason === "DROP") {
      setDynamicStyle(styles.dropAnimating);
      return;
    }
    setDynamicStyle(styles.userCancel);
  }, [setDynamicStyle, styles.dropAnimating, styles.userCancel]);
  const resting = useCallback(() => {
    if (!dynamicRef.current) {
      return;
    }
    setDynamicStyle(styles.resting);
  }, [setDynamicStyle, styles.resting]);
  const marshal = useMemo(() => ({
    dragging,
    dropping,
    resting
  }), [dragging, dropping, resting]);
  return marshal;
}
__name(useStyleMarshal, "useStyleMarshal");
function querySelectorAll(parentNode, selector) {
  return Array.from(parentNode.querySelectorAll(selector));
}
__name(querySelectorAll, "querySelectorAll");
var getWindowFromEl = /* @__PURE__ */ __name((el) => {
  if (el && el.ownerDocument && el.ownerDocument.defaultView) {
    return el.ownerDocument.defaultView;
  }
  return window;
}, "getWindowFromEl");
function isHtmlElement(el) {
  return el instanceof getWindowFromEl(el).HTMLElement;
}
__name(isHtmlElement, "isHtmlElement");
function findDragHandle(contextId, draggableId) {
  const selector = `[${dragHandle.contextId}="${contextId}"]`;
  const possible = querySelectorAll(document, selector);
  if (!possible.length) {
    return null;
  }
  const handle = possible.find((el) => {
    return el.getAttribute(dragHandle.draggableId) === draggableId;
  });
  if (!handle) {
    return null;
  }
  if (!isHtmlElement(handle)) {
    return null;
  }
  return handle;
}
__name(findDragHandle, "findDragHandle");
function useFocusMarshal(contextId) {
  const entriesRef = reactExports.useRef({});
  const recordRef = reactExports.useRef(null);
  const restoreFocusFrameRef = reactExports.useRef(null);
  const isMountedRef = reactExports.useRef(false);
  const register = useCallback(/* @__PURE__ */ __name(function register2(id, focus2) {
    const entry = {
      id,
      focus: focus2
    };
    entriesRef.current[id] = entry;
    return /* @__PURE__ */ __name(function unregister() {
      const entries = entriesRef.current;
      const current = entries[id];
      if (current !== entry) {
        delete entries[id];
      }
    }, "unregister");
  }, "register2"), []);
  const tryGiveFocus = useCallback(/* @__PURE__ */ __name(function tryGiveFocus2(tryGiveFocusTo) {
    const handle = findDragHandle(contextId, tryGiveFocusTo);
    if (handle && handle !== document.activeElement) {
      handle.focus();
    }
  }, "tryGiveFocus2"), [contextId]);
  const tryShiftRecord = useCallback(/* @__PURE__ */ __name(function tryShiftRecord2(previous, redirectTo) {
    if (recordRef.current === previous) {
      recordRef.current = redirectTo;
    }
  }, "tryShiftRecord2"), []);
  const tryRestoreFocusRecorded = useCallback(/* @__PURE__ */ __name(function tryRestoreFocusRecorded2() {
    if (restoreFocusFrameRef.current) {
      return;
    }
    if (!isMountedRef.current) {
      return;
    }
    restoreFocusFrameRef.current = requestAnimationFrame(() => {
      restoreFocusFrameRef.current = null;
      const record = recordRef.current;
      if (record) {
        tryGiveFocus(record);
      }
    });
  }, "tryRestoreFocusRecorded2"), [tryGiveFocus]);
  const tryRecordFocus = useCallback(/* @__PURE__ */ __name(function tryRecordFocus2(id) {
    recordRef.current = null;
    const focused = document.activeElement;
    if (!focused) {
      return;
    }
    if (focused.getAttribute(dragHandle.draggableId) !== id) {
      return;
    }
    recordRef.current = id;
  }, "tryRecordFocus2"), []);
  useIsomorphicLayoutEffect(() => {
    isMountedRef.current = true;
    return /* @__PURE__ */ __name(function clearFrameOnUnmount() {
      isMountedRef.current = false;
      const frameId = restoreFocusFrameRef.current;
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    }, "clearFrameOnUnmount");
  }, []);
  const marshal = useMemo(() => ({
    register,
    tryRecordFocus,
    tryRestoreFocusRecorded,
    tryShiftRecord
  }), [register, tryRecordFocus, tryRestoreFocusRecorded, tryShiftRecord]);
  return marshal;
}
__name(useFocusMarshal, "useFocusMarshal");
function createRegistry() {
  const entries = {
    draggables: {},
    droppables: {}
  };
  const subscribers = [];
  function subscribe(cb) {
    subscribers.push(cb);
    return /* @__PURE__ */ __name(function unsubscribe() {
      const index = subscribers.indexOf(cb);
      if (index === -1) {
        return;
      }
      subscribers.splice(index, 1);
    }, "unsubscribe");
  }
  __name(subscribe, "subscribe");
  function notify(event) {
    if (subscribers.length) {
      subscribers.forEach((cb) => cb(event));
    }
  }
  __name(notify, "notify");
  function findDraggableById(id) {
    return entries.draggables[id] || null;
  }
  __name(findDraggableById, "findDraggableById");
  function getDraggableById(id) {
    const entry = findDraggableById(id);
    !entry ? invariant() : void 0;
    return entry;
  }
  __name(getDraggableById, "getDraggableById");
  const draggableAPI = {
    register: /* @__PURE__ */ __name((entry) => {
      entries.draggables[entry.descriptor.id] = entry;
      notify({
        type: "ADDITION",
        value: entry
      });
    }, "register"),
    update: /* @__PURE__ */ __name((entry, last) => {
      const current = entries.draggables[last.descriptor.id];
      if (!current) {
        return;
      }
      if (current.uniqueId !== entry.uniqueId) {
        return;
      }
      delete entries.draggables[last.descriptor.id];
      entries.draggables[entry.descriptor.id] = entry;
    }, "update"),
    unregister: /* @__PURE__ */ __name((entry) => {
      const draggableId = entry.descriptor.id;
      const current = findDraggableById(draggableId);
      if (!current) {
        return;
      }
      if (entry.uniqueId !== current.uniqueId) {
        return;
      }
      delete entries.draggables[draggableId];
      if (entries.droppables[entry.descriptor.droppableId]) {
        notify({
          type: "REMOVAL",
          value: entry
        });
      }
    }, "unregister"),
    getById: getDraggableById,
    findById: findDraggableById,
    exists: /* @__PURE__ */ __name((id) => Boolean(findDraggableById(id)), "exists"),
    getAllByType: /* @__PURE__ */ __name((type) => Object.values(entries.draggables).filter((entry) => entry.descriptor.type === type), "getAllByType")
  };
  function findDroppableById(id) {
    return entries.droppables[id] || null;
  }
  __name(findDroppableById, "findDroppableById");
  function getDroppableById(id) {
    const entry = findDroppableById(id);
    !entry ? invariant() : void 0;
    return entry;
  }
  __name(getDroppableById, "getDroppableById");
  const droppableAPI = {
    register: /* @__PURE__ */ __name((entry) => {
      entries.droppables[entry.descriptor.id] = entry;
    }, "register"),
    unregister: /* @__PURE__ */ __name((entry) => {
      const current = findDroppableById(entry.descriptor.id);
      if (!current) {
        return;
      }
      if (entry.uniqueId !== current.uniqueId) {
        return;
      }
      delete entries.droppables[entry.descriptor.id];
    }, "unregister"),
    getById: getDroppableById,
    findById: findDroppableById,
    exists: /* @__PURE__ */ __name((id) => Boolean(findDroppableById(id)), "exists"),
    getAllByType: /* @__PURE__ */ __name((type) => Object.values(entries.droppables).filter((entry) => entry.descriptor.type === type), "getAllByType")
  };
  function clean2() {
    entries.draggables = {};
    entries.droppables = {};
    subscribers.length = 0;
  }
  __name(clean2, "clean2");
  return {
    draggable: draggableAPI,
    droppable: droppableAPI,
    subscribe,
    clean: clean2
  };
}
__name(createRegistry, "createRegistry");
function useRegistry() {
  const registry = useMemo(createRegistry, []);
  reactExports.useEffect(() => {
    return /* @__PURE__ */ __name(function unmount() {
      registry.clean();
    }, "unmount");
  }, [registry]);
  return registry;
}
__name(useRegistry, "useRegistry");
var StoreContext = React.createContext(null);
var getBodyElement = /* @__PURE__ */ __name(() => {
  const body = document.body;
  !body ? invariant() : void 0;
  return body;
}, "getBodyElement");
const visuallyHidden = {
  position: "absolute",
  width: "1px",
  height: "1px",
  margin: "-1px",
  border: "0",
  padding: "0",
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  "clip-path": "inset(100%)"
};
const getId = /* @__PURE__ */ __name((contextId) => `rfd-announcement-${contextId}`, "getId");
function useAnnouncer(contextId) {
  const id = useMemo(() => getId(contextId), [contextId]);
  const ref2 = reactExports.useRef(null);
  reactExports.useEffect(/* @__PURE__ */ __name(function setup() {
    const el = document.createElement("div");
    ref2.current = el;
    el.id = id;
    el.setAttribute("aria-live", "assertive");
    el.setAttribute("aria-atomic", "true");
    _extends(el.style, visuallyHidden);
    getBodyElement().appendChild(el);
    return /* @__PURE__ */ __name(function cleanup() {
      setTimeout(/* @__PURE__ */ __name(function remove() {
        const body = getBodyElement();
        if (body.contains(el)) {
          body.removeChild(el);
        }
        if (el === ref2.current) {
          ref2.current = null;
        }
      }, "remove"));
    }, "cleanup");
  }, "setup"), [id]);
  const announce = useCallback((message) => {
    const el = ref2.current;
    if (el) {
      el.textContent = message;
      return;
    }
  }, []);
  return announce;
}
__name(useAnnouncer, "useAnnouncer");
const defaults = {
  separator: "::"
};
function useUniqueId(prefix2, options = defaults) {
  const id = React.useId();
  return useMemo(() => `${prefix2}${options.separator}${id}`, [options.separator, prefix2, id]);
}
__name(useUniqueId, "useUniqueId");
function getElementId({
  contextId,
  uniqueId
}) {
  return `rfd-hidden-text-${contextId}-${uniqueId}`;
}
__name(getElementId, "getElementId");
function useHiddenTextElement({
  contextId,
  text
}) {
  const uniqueId = useUniqueId("hidden-text", {
    separator: "-"
  });
  const id = useMemo(() => getElementId({
    contextId,
    uniqueId
  }), [uniqueId, contextId]);
  reactExports.useEffect(/* @__PURE__ */ __name(function mount() {
    const el = document.createElement("div");
    el.id = id;
    el.textContent = text;
    el.style.display = "none";
    getBodyElement().appendChild(el);
    return /* @__PURE__ */ __name(function unmount() {
      const body = getBodyElement();
      if (body.contains(el)) {
        body.removeChild(el);
      }
    }, "unmount");
  }, "mount"), [id, text]);
  return id;
}
__name(useHiddenTextElement, "useHiddenTextElement");
var AppContext = React.createContext(null);
function usePrevious(current) {
  const ref2 = reactExports.useRef(current);
  reactExports.useEffect(() => {
    ref2.current = current;
  });
  return ref2;
}
__name(usePrevious, "usePrevious");
function create() {
  let lock = null;
  function isClaimed() {
    return Boolean(lock);
  }
  __name(isClaimed, "isClaimed");
  function isActive2(value) {
    return value === lock;
  }
  __name(isActive2, "isActive2");
  function claim(abandon) {
    !!lock ? invariant() : void 0;
    const newLock = {
      abandon
    };
    lock = newLock;
    return newLock;
  }
  __name(claim, "claim");
  function release() {
    !lock ? invariant() : void 0;
    lock = null;
  }
  __name(release, "release");
  function tryAbandon() {
    if (lock) {
      lock.abandon();
      release();
    }
  }
  __name(tryAbandon, "tryAbandon");
  return {
    isClaimed,
    isActive: isActive2,
    claim,
    release,
    tryAbandon
  };
}
__name(create, "create");
function isDragging(state) {
  if (state.phase === "IDLE" || state.phase === "DROP_ANIMATING") {
    return false;
  }
  return state.isDragging;
}
__name(isDragging, "isDragging");
const tab = 9;
const enter = 13;
const escape = 27;
const space = 32;
const pageUp = 33;
const pageDown = 34;
const end = 35;
const home = 36;
const arrowLeft = 37;
const arrowUp = 38;
const arrowRight = 39;
const arrowDown = 40;
const preventedKeys = {
  [enter]: true,
  [tab]: true
};
var preventStandardKeyEvents = /* @__PURE__ */ __name((event) => {
  if (preventedKeys[event.keyCode]) {
    event.preventDefault();
  }
}, "preventStandardKeyEvents");
const supportedEventName = (() => {
  const base = "visibilitychange";
  if (typeof document === "undefined") {
    return base;
  }
  const candidates = [base, `ms${base}`, `webkit${base}`, `moz${base}`, `o${base}`];
  const supported = candidates.find((eventName) => `on${eventName}` in document);
  return supported || base;
})();
const primaryButton = 0;
const sloppyClickThreshold = 5;
function isSloppyClickThresholdExceeded(original, current) {
  return Math.abs(current.x - original.x) >= sloppyClickThreshold || Math.abs(current.y - original.y) >= sloppyClickThreshold;
}
__name(isSloppyClickThresholdExceeded, "isSloppyClickThresholdExceeded");
const idle$1 = {
  type: "IDLE"
};
function getCaptureBindings({
  cancel,
  completed,
  getPhase,
  setPhase
}) {
  return [{
    eventName: "mousemove",
    fn: /* @__PURE__ */ __name((event) => {
      const {
        button,
        clientX,
        clientY
      } = event;
      if (button !== primaryButton) {
        return;
      }
      const point = {
        x: clientX,
        y: clientY
      };
      const phase = getPhase();
      if (phase.type === "DRAGGING") {
        event.preventDefault();
        phase.actions.move(point);
        return;
      }
      !(phase.type === "PENDING") ? invariant() : void 0;
      const pending = phase.point;
      if (!isSloppyClickThresholdExceeded(pending, point)) {
        return;
      }
      event.preventDefault();
      const actions = phase.actions.fluidLift(point);
      setPhase({
        type: "DRAGGING",
        actions
      });
    }, "fn")
  }, {
    eventName: "mouseup",
    fn: /* @__PURE__ */ __name((event) => {
      const phase = getPhase();
      if (phase.type !== "DRAGGING") {
        cancel();
        return;
      }
      event.preventDefault();
      phase.actions.drop({
        shouldBlockNextClick: true
      });
      completed();
    }, "fn")
  }, {
    eventName: "mousedown",
    fn: /* @__PURE__ */ __name((event) => {
      if (getPhase().type === "DRAGGING") {
        event.preventDefault();
      }
      cancel();
    }, "fn")
  }, {
    eventName: "keydown",
    fn: /* @__PURE__ */ __name((event) => {
      const phase = getPhase();
      if (phase.type === "PENDING") {
        cancel();
        return;
      }
      if (event.keyCode === escape) {
        event.preventDefault();
        cancel();
        return;
      }
      preventStandardKeyEvents(event);
    }, "fn")
  }, {
    eventName: "resize",
    fn: cancel
  }, {
    eventName: "scroll",
    options: {
      passive: true,
      capture: false
    },
    fn: /* @__PURE__ */ __name(() => {
      if (getPhase().type === "PENDING") {
        cancel();
      }
    }, "fn")
  }, {
    eventName: "webkitmouseforcedown",
    fn: /* @__PURE__ */ __name((event) => {
      const phase = getPhase();
      !(phase.type !== "IDLE") ? invariant() : void 0;
      if (phase.actions.shouldRespectForcePress()) {
        cancel();
        return;
      }
      event.preventDefault();
    }, "fn")
  }, {
    eventName: supportedEventName,
    fn: cancel
  }];
}
__name(getCaptureBindings, "getCaptureBindings");
function useMouseSensor(api) {
  const phaseRef = reactExports.useRef(idle$1);
  const unbindEventsRef = reactExports.useRef(noop$2);
  const startCaptureBinding = useMemo(() => ({
    eventName: "mousedown",
    fn: /* @__PURE__ */ __name(function onMouseDown(event) {
      if (event.defaultPrevented) {
        return;
      }
      if (event.button !== primaryButton) {
        return;
      }
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
        return;
      }
      const draggableId = api.findClosestDraggableId(event);
      if (!draggableId) {
        return;
      }
      const actions = api.tryGetLock(draggableId, stop, {
        sourceEvent: event
      });
      if (!actions) {
        return;
      }
      event.preventDefault();
      const point = {
        x: event.clientX,
        y: event.clientY
      };
      unbindEventsRef.current();
      startPendingDrag(actions, point);
    }, "onMouseDown")
  }), [api]);
  const preventForcePressBinding = useMemo(() => ({
    eventName: "webkitmouseforcewillbegin",
    fn: /* @__PURE__ */ __name((event) => {
      if (event.defaultPrevented) {
        return;
      }
      const id = api.findClosestDraggableId(event);
      if (!id) {
        return;
      }
      const options = api.findOptionsForDraggable(id);
      if (!options) {
        return;
      }
      if (options.shouldRespectForcePress) {
        return;
      }
      if (!api.canGetLock(id)) {
        return;
      }
      event.preventDefault();
    }, "fn")
  }), [api]);
  const listenForCapture = useCallback(/* @__PURE__ */ __name(function listenForCapture2() {
    const options = {
      passive: false,
      capture: true
    };
    unbindEventsRef.current = bindEvents(window, [preventForcePressBinding, startCaptureBinding], options);
  }, "listenForCapture2"), [preventForcePressBinding, startCaptureBinding]);
  const stop = useCallback(() => {
    const current = phaseRef.current;
    if (current.type === "IDLE") {
      return;
    }
    phaseRef.current = idle$1;
    unbindEventsRef.current();
    listenForCapture();
  }, [listenForCapture]);
  const cancel = useCallback(() => {
    const phase = phaseRef.current;
    stop();
    if (phase.type === "DRAGGING") {
      phase.actions.cancel({
        shouldBlockNextClick: true
      });
    }
    if (phase.type === "PENDING") {
      phase.actions.abort();
    }
  }, [stop]);
  const bindCapturingEvents = useCallback(/* @__PURE__ */ __name(function bindCapturingEvents2() {
    const options = {
      capture: true,
      passive: false
    };
    const bindings = getCaptureBindings({
      cancel,
      completed: stop,
      getPhase: /* @__PURE__ */ __name(() => phaseRef.current, "getPhase"),
      setPhase: /* @__PURE__ */ __name((phase) => {
        phaseRef.current = phase;
      }, "setPhase")
    });
    unbindEventsRef.current = bindEvents(window, bindings, options);
  }, "bindCapturingEvents2"), [cancel, stop]);
  const startPendingDrag = useCallback(/* @__PURE__ */ __name(function startPendingDrag2(actions, point) {
    !(phaseRef.current.type === "IDLE") ? invariant() : void 0;
    phaseRef.current = {
      type: "PENDING",
      point,
      actions
    };
    bindCapturingEvents();
  }, "startPendingDrag2"), [bindCapturingEvents]);
  useIsomorphicLayoutEffect(/* @__PURE__ */ __name(function mount() {
    listenForCapture();
    return /* @__PURE__ */ __name(function unmount() {
      unbindEventsRef.current();
    }, "unmount");
  }, "mount"), [listenForCapture]);
}
__name(useMouseSensor, "useMouseSensor");
function noop$1() {
}
__name(noop$1, "noop$1");
const scrollJumpKeys = {
  [pageDown]: true,
  [pageUp]: true,
  [home]: true,
  [end]: true
};
function getDraggingBindings(actions, stop) {
  function cancel() {
    stop();
    actions.cancel();
  }
  __name(cancel, "cancel");
  function drop2() {
    stop();
    actions.drop();
  }
  __name(drop2, "drop2");
  return [{
    eventName: "keydown",
    fn: /* @__PURE__ */ __name((event) => {
      if (event.keyCode === escape) {
        event.preventDefault();
        cancel();
        return;
      }
      if (event.keyCode === space) {
        event.preventDefault();
        drop2();
        return;
      }
      if (event.keyCode === arrowDown) {
        event.preventDefault();
        actions.moveDown();
        return;
      }
      if (event.keyCode === arrowUp) {
        event.preventDefault();
        actions.moveUp();
        return;
      }
      if (event.keyCode === arrowRight) {
        event.preventDefault();
        actions.moveRight();
        return;
      }
      if (event.keyCode === arrowLeft) {
        event.preventDefault();
        actions.moveLeft();
        return;
      }
      if (scrollJumpKeys[event.keyCode]) {
        event.preventDefault();
        return;
      }
      preventStandardKeyEvents(event);
    }, "fn")
  }, {
    eventName: "mousedown",
    fn: cancel
  }, {
    eventName: "mouseup",
    fn: cancel
  }, {
    eventName: "click",
    fn: cancel
  }, {
    eventName: "touchstart",
    fn: cancel
  }, {
    eventName: "resize",
    fn: cancel
  }, {
    eventName: "wheel",
    fn: cancel,
    options: {
      passive: true
    }
  }, {
    eventName: supportedEventName,
    fn: cancel
  }];
}
__name(getDraggingBindings, "getDraggingBindings");
function useKeyboardSensor(api) {
  const unbindEventsRef = reactExports.useRef(noop$1);
  const startCaptureBinding = useMemo(() => ({
    eventName: "keydown",
    fn: /* @__PURE__ */ __name(function onKeyDown(event) {
      if (event.defaultPrevented) {
        return;
      }
      if (event.keyCode !== space) {
        return;
      }
      const draggableId = api.findClosestDraggableId(event);
      if (!draggableId) {
        return;
      }
      const preDrag = api.tryGetLock(draggableId, stop, {
        sourceEvent: event
      });
      if (!preDrag) {
        return;
      }
      event.preventDefault();
      let isCapturing = true;
      const actions = preDrag.snapLift();
      unbindEventsRef.current();
      function stop() {
        !isCapturing ? invariant() : void 0;
        isCapturing = false;
        unbindEventsRef.current();
        listenForCapture();
      }
      __name(stop, "stop");
      unbindEventsRef.current = bindEvents(window, getDraggingBindings(actions, stop), {
        capture: true,
        passive: false
      });
    }, "onKeyDown")
  }), [api]);
  const listenForCapture = useCallback(/* @__PURE__ */ __name(function tryStartCapture() {
    const options = {
      passive: false,
      capture: true
    };
    unbindEventsRef.current = bindEvents(window, [startCaptureBinding], options);
  }, "tryStartCapture"), [startCaptureBinding]);
  useIsomorphicLayoutEffect(/* @__PURE__ */ __name(function mount() {
    listenForCapture();
    return /* @__PURE__ */ __name(function unmount() {
      unbindEventsRef.current();
    }, "unmount");
  }, "mount"), [listenForCapture]);
}
__name(useKeyboardSensor, "useKeyboardSensor");
const idle = {
  type: "IDLE"
};
const timeForLongPress = 120;
const forcePressThreshold = 0.15;
function getWindowBindings({
  cancel,
  getPhase
}) {
  return [{
    eventName: "orientationchange",
    fn: cancel
  }, {
    eventName: "resize",
    fn: cancel
  }, {
    eventName: "contextmenu",
    fn: /* @__PURE__ */ __name((event) => {
      event.preventDefault();
    }, "fn")
  }, {
    eventName: "keydown",
    fn: /* @__PURE__ */ __name((event) => {
      if (getPhase().type !== "DRAGGING") {
        cancel();
        return;
      }
      if (event.keyCode === escape) {
        event.preventDefault();
      }
      cancel();
    }, "fn")
  }, {
    eventName: supportedEventName,
    fn: cancel
  }];
}
__name(getWindowBindings, "getWindowBindings");
function getHandleBindings({
  cancel,
  completed,
  getPhase
}) {
  return [{
    eventName: "touchmove",
    options: {
      capture: false
    },
    fn: /* @__PURE__ */ __name((event) => {
      const phase = getPhase();
      if (phase.type !== "DRAGGING") {
        cancel();
        return;
      }
      phase.hasMoved = true;
      const {
        clientX,
        clientY
      } = event.touches[0];
      const point = {
        x: clientX,
        y: clientY
      };
      event.preventDefault();
      phase.actions.move(point);
    }, "fn")
  }, {
    eventName: "touchend",
    fn: /* @__PURE__ */ __name((event) => {
      const phase = getPhase();
      if (phase.type !== "DRAGGING") {
        cancel();
        return;
      }
      event.preventDefault();
      phase.actions.drop({
        shouldBlockNextClick: true
      });
      completed();
    }, "fn")
  }, {
    eventName: "touchcancel",
    fn: /* @__PURE__ */ __name((event) => {
      if (getPhase().type !== "DRAGGING") {
        cancel();
        return;
      }
      event.preventDefault();
      cancel();
    }, "fn")
  }, {
    eventName: "touchforcechange",
    fn: /* @__PURE__ */ __name((event) => {
      const phase = getPhase();
      !(phase.type !== "IDLE") ? invariant() : void 0;
      const touch = event.touches[0];
      if (!touch) {
        return;
      }
      const isForcePress = touch.force >= forcePressThreshold;
      if (!isForcePress) {
        return;
      }
      const shouldRespect = phase.actions.shouldRespectForcePress();
      if (phase.type === "PENDING") {
        if (shouldRespect) {
          cancel();
        }
        return;
      }
      if (shouldRespect) {
        if (phase.hasMoved) {
          event.preventDefault();
          return;
        }
        cancel();
        return;
      }
      event.preventDefault();
    }, "fn")
  }, {
    eventName: supportedEventName,
    fn: cancel
  }];
}
__name(getHandleBindings, "getHandleBindings");
function useTouchSensor(api) {
  const phaseRef = reactExports.useRef(idle);
  const unbindEventsRef = reactExports.useRef(noop$2);
  const getPhase = useCallback(/* @__PURE__ */ __name(function getPhase2() {
    return phaseRef.current;
  }, "getPhase2"), []);
  const setPhase = useCallback(/* @__PURE__ */ __name(function setPhase2(phase) {
    phaseRef.current = phase;
  }, "setPhase2"), []);
  const startCaptureBinding = useMemo(() => ({
    eventName: "touchstart",
    fn: /* @__PURE__ */ __name(function onTouchStart(event) {
      if (event.defaultPrevented) {
        return;
      }
      const draggableId = api.findClosestDraggableId(event);
      if (!draggableId) {
        return;
      }
      const actions = api.tryGetLock(draggableId, stop, {
        sourceEvent: event
      });
      if (!actions) {
        return;
      }
      const touch = event.touches[0];
      const {
        clientX,
        clientY
      } = touch;
      const point = {
        x: clientX,
        y: clientY
      };
      unbindEventsRef.current();
      startPendingDrag(actions, point);
    }, "onTouchStart")
  }), [api]);
  const listenForCapture = useCallback(/* @__PURE__ */ __name(function listenForCapture2() {
    const options = {
      capture: true,
      passive: false
    };
    unbindEventsRef.current = bindEvents(window, [startCaptureBinding], options);
  }, "listenForCapture2"), [startCaptureBinding]);
  const stop = useCallback(() => {
    const current = phaseRef.current;
    if (current.type === "IDLE") {
      return;
    }
    if (current.type === "PENDING") {
      clearTimeout(current.longPressTimerId);
    }
    setPhase(idle);
    unbindEventsRef.current();
    listenForCapture();
  }, [listenForCapture, setPhase]);
  const cancel = useCallback(() => {
    const phase = phaseRef.current;
    stop();
    if (phase.type === "DRAGGING") {
      phase.actions.cancel({
        shouldBlockNextClick: true
      });
    }
    if (phase.type === "PENDING") {
      phase.actions.abort();
    }
  }, [stop]);
  const bindCapturingEvents = useCallback(/* @__PURE__ */ __name(function bindCapturingEvents2() {
    const options = {
      capture: true,
      passive: false
    };
    const args = {
      cancel,
      completed: stop,
      getPhase
    };
    const unbindTarget = bindEvents(window, getHandleBindings(args), options);
    const unbindWindow = bindEvents(window, getWindowBindings(args), options);
    unbindEventsRef.current = /* @__PURE__ */ __name(function unbindAll() {
      unbindTarget();
      unbindWindow();
    }, "unbindAll");
  }, "bindCapturingEvents2"), [cancel, getPhase, stop]);
  const startDragging = useCallback(/* @__PURE__ */ __name(function startDragging2() {
    const phase = getPhase();
    !(phase.type === "PENDING") ? invariant() : void 0;
    const actions = phase.actions.fluidLift(phase.point);
    setPhase({
      type: "DRAGGING",
      actions,
      hasMoved: false
    });
  }, "startDragging2"), [getPhase, setPhase]);
  const startPendingDrag = useCallback(/* @__PURE__ */ __name(function startPendingDrag2(actions, point) {
    !(getPhase().type === "IDLE") ? invariant() : void 0;
    const longPressTimerId = setTimeout(startDragging, timeForLongPress);
    setPhase({
      type: "PENDING",
      point,
      actions,
      longPressTimerId
    });
    bindCapturingEvents();
  }, "startPendingDrag2"), [bindCapturingEvents, getPhase, setPhase, startDragging]);
  useIsomorphicLayoutEffect(/* @__PURE__ */ __name(function mount() {
    listenForCapture();
    return /* @__PURE__ */ __name(function unmount() {
      unbindEventsRef.current();
      const phase = getPhase();
      if (phase.type === "PENDING") {
        clearTimeout(phase.longPressTimerId);
        setPhase(idle);
      }
    }, "unmount");
  }, "mount"), [getPhase, listenForCapture, setPhase]);
  useIsomorphicLayoutEffect(/* @__PURE__ */ __name(function webkitHack() {
    const unbind = bindEvents(window, [{
      eventName: "touchmove",
      fn: /* @__PURE__ */ __name(() => {
      }, "fn"),
      options: {
        capture: false,
        passive: false
      }
    }]);
    return unbind;
  }, "webkitHack"), []);
}
__name(useTouchSensor, "useTouchSensor");
const interactiveTagNames = ["input", "button", "textarea", "select", "option", "optgroup", "video", "audio"];
function isAnInteractiveElement(parent, current) {
  if (current == null) {
    return false;
  }
  const hasAnInteractiveTag = interactiveTagNames.includes(current.tagName.toLowerCase());
  if (hasAnInteractiveTag) {
    return true;
  }
  const attribute = current.getAttribute("contenteditable");
  if (attribute === "true" || attribute === "") {
    return true;
  }
  if (current === parent) {
    return false;
  }
  return isAnInteractiveElement(parent, current.parentElement);
}
__name(isAnInteractiveElement, "isAnInteractiveElement");
function isEventInInteractiveElement(draggable2, event) {
  const target = event.target;
  if (!isHtmlElement(target)) {
    return false;
  }
  return isAnInteractiveElement(draggable2, target);
}
__name(isEventInInteractiveElement, "isEventInInteractiveElement");
var getBorderBoxCenterPosition = /* @__PURE__ */ __name((el) => getRect(el.getBoundingClientRect()).center, "getBorderBoxCenterPosition");
function isElement(el) {
  return el instanceof getWindowFromEl(el).Element;
}
__name(isElement, "isElement");
const supportedMatchesName = (() => {
  const base = "matches";
  if (typeof document === "undefined") {
    return base;
  }
  const candidates = [base, "msMatchesSelector", "webkitMatchesSelector"];
  const value = candidates.find((name) => name in Element.prototype);
  return value || base;
})();
function closestPonyfill(el, selector) {
  if (el == null) {
    return null;
  }
  if (el[supportedMatchesName](selector)) {
    return el;
  }
  return closestPonyfill(el.parentElement, selector);
}
__name(closestPonyfill, "closestPonyfill");
function closest(el, selector) {
  if (el.closest) {
    return el.closest(selector);
  }
  return closestPonyfill(el, selector);
}
__name(closest, "closest");
function getSelector(contextId) {
  return `[${dragHandle.contextId}="${contextId}"]`;
}
__name(getSelector, "getSelector");
function findClosestDragHandleFromEvent(contextId, event) {
  const target = event.target;
  if (!isElement(target)) {
    return null;
  }
  const selector = getSelector(contextId);
  const handle = closest(target, selector);
  if (!handle) {
    return null;
  }
  if (!isHtmlElement(handle)) {
    return null;
  }
  return handle;
}
__name(findClosestDragHandleFromEvent, "findClosestDragHandleFromEvent");
function tryGetClosestDraggableIdFromEvent(contextId, event) {
  const handle = findClosestDragHandleFromEvent(contextId, event);
  if (!handle) {
    return null;
  }
  return handle.getAttribute(dragHandle.draggableId);
}
__name(tryGetClosestDraggableIdFromEvent, "tryGetClosestDraggableIdFromEvent");
function findDraggable(contextId, draggableId) {
  const selector = `[${draggable.contextId}="${contextId}"]`;
  const possible = querySelectorAll(document, selector);
  const draggable$1 = possible.find((el) => {
    return el.getAttribute(draggable.id) === draggableId;
  });
  if (!draggable$1) {
    return null;
  }
  if (!isHtmlElement(draggable$1)) {
    return null;
  }
  return draggable$1;
}
__name(findDraggable, "findDraggable");
function preventDefault(event) {
  event.preventDefault();
}
__name(preventDefault, "preventDefault");
function isActive({
  expected,
  phase,
  isLockActive,
  shouldWarn
}) {
  if (!isLockActive()) {
    return false;
  }
  if (expected !== phase) {
    return false;
  }
  return true;
}
__name(isActive, "isActive");
function canStart({
  lockAPI,
  store,
  registry,
  draggableId
}) {
  if (lockAPI.isClaimed()) {
    return false;
  }
  const entry = registry.draggable.findById(draggableId);
  if (!entry) {
    return false;
  }
  if (!entry.options.isEnabled) {
    return false;
  }
  if (!canStartDrag(store.getState(), draggableId)) {
    return false;
  }
  return true;
}
__name(canStart, "canStart");
function tryStart({
  lockAPI,
  contextId,
  store,
  registry,
  draggableId,
  forceSensorStop,
  sourceEvent
}) {
  const shouldStart = canStart({
    lockAPI,
    store,
    registry,
    draggableId
  });
  if (!shouldStart) {
    return null;
  }
  const entry = registry.draggable.getById(draggableId);
  const el = findDraggable(contextId, entry.descriptor.id);
  if (!el) {
    return null;
  }
  if (sourceEvent && !entry.options.canDragInteractiveElements && isEventInInteractiveElement(el, sourceEvent)) {
    return null;
  }
  const lock = lockAPI.claim(forceSensorStop || noop$2);
  let phase = "PRE_DRAG";
  function getShouldRespectForcePress() {
    return entry.options.shouldRespectForcePress;
  }
  __name(getShouldRespectForcePress, "getShouldRespectForcePress");
  function isLockActive() {
    return lockAPI.isActive(lock);
  }
  __name(isLockActive, "isLockActive");
  function tryDispatch(expected, getAction) {
    if (isActive({
      expected,
      phase,
      isLockActive,
      shouldWarn: true
    })) {
      store.dispatch(getAction());
    }
  }
  __name(tryDispatch, "tryDispatch");
  const tryDispatchWhenDragging = tryDispatch.bind(null, "DRAGGING");
  function lift2(args) {
    function completed() {
      lockAPI.release();
      phase = "COMPLETED";
    }
    __name(completed, "completed");
    if (phase !== "PRE_DRAG") {
      completed();
      invariant();
    }
    store.dispatch(lift$1(args.liftActionArgs));
    phase = "DRAGGING";
    function finish2(reason, options = {
      shouldBlockNextClick: false
    }) {
      args.cleanup();
      if (options.shouldBlockNextClick) {
        const unbind = bindEvents(window, [{
          eventName: "click",
          fn: preventDefault,
          options: {
            once: true,
            passive: false,
            capture: true
          }
        }]);
        setTimeout(unbind);
      }
      completed();
      store.dispatch(drop({
        reason
      }));
    }
    __name(finish2, "finish2");
    return {
      isActive: /* @__PURE__ */ __name(() => isActive({
        expected: "DRAGGING",
        phase,
        isLockActive,
        shouldWarn: false
      }), "isActive"),
      shouldRespectForcePress: getShouldRespectForcePress,
      drop: /* @__PURE__ */ __name((options) => finish2("DROP", options), "drop"),
      cancel: /* @__PURE__ */ __name((options) => finish2("CANCEL", options), "cancel"),
      ...args.actions
    };
  }
  __name(lift2, "lift2");
  function fluidLift(clientSelection) {
    const move$1 = rafSchd((client) => {
      tryDispatchWhenDragging(() => move({
        client
      }));
    });
    const api = lift2({
      liftActionArgs: {
        id: draggableId,
        clientSelection,
        movementMode: "FLUID"
      },
      cleanup: /* @__PURE__ */ __name(() => move$1.cancel(), "cleanup"),
      actions: {
        move: move$1
      }
    });
    return {
      ...api,
      move: move$1
    };
  }
  __name(fluidLift, "fluidLift");
  function snapLift() {
    const actions = {
      moveUp: /* @__PURE__ */ __name(() => tryDispatchWhenDragging(moveUp), "moveUp"),
      moveRight: /* @__PURE__ */ __name(() => tryDispatchWhenDragging(moveRight), "moveRight"),
      moveDown: /* @__PURE__ */ __name(() => tryDispatchWhenDragging(moveDown), "moveDown"),
      moveLeft: /* @__PURE__ */ __name(() => tryDispatchWhenDragging(moveLeft), "moveLeft")
    };
    return lift2({
      liftActionArgs: {
        id: draggableId,
        clientSelection: getBorderBoxCenterPosition(el),
        movementMode: "SNAP"
      },
      cleanup: noop$2,
      actions
    });
  }
  __name(snapLift, "snapLift");
  function abortPreDrag() {
    const shouldRelease = isActive({
      expected: "PRE_DRAG",
      phase,
      isLockActive,
      shouldWarn: true
    });
    if (shouldRelease) {
      lockAPI.release();
    }
  }
  __name(abortPreDrag, "abortPreDrag");
  const preDrag = {
    isActive: /* @__PURE__ */ __name(() => isActive({
      expected: "PRE_DRAG",
      phase,
      isLockActive,
      shouldWarn: false
    }), "isActive"),
    shouldRespectForcePress: getShouldRespectForcePress,
    fluidLift,
    snapLift,
    abort: abortPreDrag
  };
  return preDrag;
}
__name(tryStart, "tryStart");
const defaultSensors = [useMouseSensor, useKeyboardSensor, useTouchSensor];
function useSensorMarshal({
  contextId,
  store,
  registry,
  customSensors,
  enableDefaultSensors
}) {
  const useSensors = [...enableDefaultSensors ? defaultSensors : [], ...customSensors || []];
  const lockAPI = reactExports.useState(() => create())[0];
  const tryAbandonLock = useCallback(/* @__PURE__ */ __name(function tryAbandonLock2(previous, current) {
    if (isDragging(previous) && !isDragging(current)) {
      lockAPI.tryAbandon();
    }
  }, "tryAbandonLock2"), [lockAPI]);
  useIsomorphicLayoutEffect(/* @__PURE__ */ __name(function listenToStore() {
    let previous = store.getState();
    const unsubscribe = store.subscribe(() => {
      const current = store.getState();
      tryAbandonLock(previous, current);
      previous = current;
    });
    return unsubscribe;
  }, "listenToStore"), [lockAPI, store, tryAbandonLock]);
  useIsomorphicLayoutEffect(() => {
    return lockAPI.tryAbandon;
  }, [lockAPI.tryAbandon]);
  const canGetLock = useCallback((draggableId) => {
    return canStart({
      lockAPI,
      registry,
      store,
      draggableId
    });
  }, [lockAPI, registry, store]);
  const tryGetLock = useCallback((draggableId, forceStop, options) => tryStart({
    lockAPI,
    registry,
    contextId,
    store,
    draggableId,
    forceSensorStop: forceStop || null,
    sourceEvent: options && options.sourceEvent ? options.sourceEvent : null
  }), [contextId, lockAPI, registry, store]);
  const findClosestDraggableId = useCallback((event) => tryGetClosestDraggableIdFromEvent(contextId, event), [contextId]);
  const findOptionsForDraggable = useCallback((id) => {
    const entry = registry.draggable.findById(id);
    return entry ? entry.options : null;
  }, [registry.draggable]);
  const tryReleaseLock = useCallback(/* @__PURE__ */ __name(function tryReleaseLock2() {
    if (!lockAPI.isClaimed()) {
      return;
    }
    lockAPI.tryAbandon();
    if (store.getState().phase !== "IDLE") {
      store.dispatch(flush());
    }
  }, "tryReleaseLock2"), [lockAPI, store]);
  const isLockClaimed = useCallback(() => lockAPI.isClaimed(), [lockAPI]);
  const api = useMemo(() => ({
    canGetLock,
    tryGetLock,
    findClosestDraggableId,
    findOptionsForDraggable,
    tryReleaseLock,
    isLockClaimed
  }), [canGetLock, tryGetLock, findClosestDraggableId, findOptionsForDraggable, tryReleaseLock, isLockClaimed]);
  for (let i = 0; i < useSensors.length; i++) {
    useSensors[i](api);
  }
}
__name(useSensorMarshal, "useSensorMarshal");
const createResponders = /* @__PURE__ */ __name((props) => ({
  onBeforeCapture: /* @__PURE__ */ __name((t) => {
    const onBeforeCapureCallback = /* @__PURE__ */ __name(() => {
      if (props.onBeforeCapture) {
        props.onBeforeCapture(t);
      }
    }, "onBeforeCapureCallback");
    reactDomExports.flushSync(onBeforeCapureCallback);
  }, "onBeforeCapture"),
  onBeforeDragStart: props.onBeforeDragStart,
  onDragStart: props.onDragStart,
  onDragEnd: props.onDragEnd,
  onDragUpdate: props.onDragUpdate
}), "createResponders");
const createAutoScrollerOptions = /* @__PURE__ */ __name((props) => ({
  ...defaultAutoScrollerOptions,
  ...props.autoScrollerOptions,
  durationDampening: {
    ...defaultAutoScrollerOptions.durationDampening,
    ...props.autoScrollerOptions
  }
}), "createAutoScrollerOptions");
function getStore(lazyRef) {
  !lazyRef.current ? invariant() : void 0;
  return lazyRef.current;
}
__name(getStore, "getStore");
function App(props) {
  const {
    contextId,
    setCallbacks,
    sensors,
    nonce,
    dragHandleUsageInstructions: dragHandleUsageInstructions2
  } = props;
  const lazyStoreRef = reactExports.useRef(null);
  const lastPropsRef = usePrevious(props);
  const getResponders = useCallback(() => {
    return createResponders(lastPropsRef.current);
  }, [lastPropsRef]);
  const getAutoScrollerOptions = useCallback(() => {
    return createAutoScrollerOptions(lastPropsRef.current);
  }, [lastPropsRef]);
  const announce = useAnnouncer(contextId);
  const dragHandleUsageInstructionsId = useHiddenTextElement({
    contextId,
    text: dragHandleUsageInstructions2
  });
  const styleMarshal = useStyleMarshal(contextId, nonce);
  const lazyDispatch = useCallback((action) => {
    getStore(lazyStoreRef).dispatch(action);
  }, []);
  const marshalCallbacks = useMemo(() => bindActionCreators$1({
    publishWhileDragging,
    updateDroppableScroll,
    updateDroppableIsEnabled,
    updateDroppableIsCombineEnabled,
    collectionStarting
  }, lazyDispatch), [lazyDispatch]);
  const registry = useRegistry();
  const dimensionMarshal = useMemo(() => {
    return createDimensionMarshal(registry, marshalCallbacks);
  }, [registry, marshalCallbacks]);
  const autoScroller = useMemo(() => createAutoScroller({
    scrollWindow,
    scrollDroppable: dimensionMarshal.scrollDroppable,
    getAutoScrollerOptions,
    ...bindActionCreators$1({
      move
    }, lazyDispatch)
  }), [dimensionMarshal.scrollDroppable, lazyDispatch, getAutoScrollerOptions]);
  const focusMarshal = useFocusMarshal(contextId);
  const store = useMemo(() => createStore({
    announce,
    autoScroller,
    dimensionMarshal,
    focusMarshal,
    getResponders,
    styleMarshal
  }), [announce, autoScroller, dimensionMarshal, focusMarshal, getResponders, styleMarshal]);
  lazyStoreRef.current = store;
  const tryResetStore = useCallback(() => {
    const current = getStore(lazyStoreRef);
    const state = current.getState();
    if (state.phase !== "IDLE") {
      current.dispatch(flush());
    }
  }, []);
  const isDragging2 = useCallback(() => {
    const state = getStore(lazyStoreRef).getState();
    if (state.phase === "DROP_ANIMATING") {
      return true;
    }
    if (state.phase === "IDLE") {
      return false;
    }
    return state.isDragging;
  }, []);
  const appCallbacks = useMemo(() => ({
    isDragging: isDragging2,
    tryAbort: tryResetStore
  }), [isDragging2, tryResetStore]);
  setCallbacks(appCallbacks);
  const getCanLift = useCallback((id) => canStartDrag(getStore(lazyStoreRef).getState(), id), []);
  const getIsMovementAllowed = useCallback(() => isMovementAllowed(getStore(lazyStoreRef).getState()), []);
  const appContext = useMemo(() => ({
    marshal: dimensionMarshal,
    focus: focusMarshal,
    contextId,
    canLift: getCanLift,
    isMovementAllowed: getIsMovementAllowed,
    dragHandleUsageInstructionsId,
    registry
  }), [contextId, dimensionMarshal, dragHandleUsageInstructionsId, focusMarshal, getCanLift, getIsMovementAllowed, registry]);
  useSensorMarshal({
    contextId,
    store,
    registry,
    customSensors: sensors || null,
    enableDefaultSensors: props.enableDefaultSensors !== false
  });
  reactExports.useEffect(() => {
    return tryResetStore;
  }, [tryResetStore]);
  return React.createElement(AppContext.Provider, {
    value: appContext
  }, React.createElement(Provider_default, {
    context: StoreContext,
    store
  }, props.children));
}
__name(App, "App");
function useUniqueContextId() {
  return React.useId();
}
__name(useUniqueContextId, "useUniqueContextId");
function DragDropContext(props) {
  const contextId = useUniqueContextId();
  const dragHandleUsageInstructions2 = props.dragHandleUsageInstructions || preset.dragHandleUsageInstructions;
  return React.createElement(ErrorBoundary, null, (setCallbacks) => React.createElement(App, {
    nonce: props.nonce,
    contextId,
    setCallbacks,
    dragHandleUsageInstructions: dragHandleUsageInstructions2,
    enableDefaultSensors: props.enableDefaultSensors,
    sensors: props.sensors,
    onBeforeCapture: props.onBeforeCapture,
    onBeforeDragStart: props.onBeforeDragStart,
    onDragStart: props.onDragStart,
    onDragUpdate: props.onDragUpdate,
    onDragEnd: props.onDragEnd,
    autoScrollerOptions: props.autoScrollerOptions
  }, props.children));
}
__name(DragDropContext, "DragDropContext");
const zIndexOptions = {
  dragging: 5e3,
  dropAnimating: 4500
};
const getDraggingTransition = /* @__PURE__ */ __name((shouldAnimateDragMovement, dropping) => {
  if (dropping) {
    return transitions.drop(dropping.duration);
  }
  if (shouldAnimateDragMovement) {
    return transitions.snap;
  }
  return transitions.fluid;
}, "getDraggingTransition");
const getDraggingOpacity = /* @__PURE__ */ __name((isCombining, isDropAnimating) => {
  if (!isCombining) {
    return void 0;
  }
  return isDropAnimating ? combine.opacity.drop : combine.opacity.combining;
}, "getDraggingOpacity");
const getShouldDraggingAnimate = /* @__PURE__ */ __name((dragging) => {
  if (dragging.forceShouldAnimate != null) {
    return dragging.forceShouldAnimate;
  }
  return dragging.mode === "SNAP";
}, "getShouldDraggingAnimate");
function getDraggingStyle(dragging) {
  const dimension = dragging.dimension;
  const box = dimension.client;
  const {
    offset: offset22,
    combineWith,
    dropping
  } = dragging;
  const isCombining = Boolean(combineWith);
  const shouldAnimate = getShouldDraggingAnimate(dragging);
  const isDropAnimating = Boolean(dropping);
  const transform = isDropAnimating ? transforms.drop(offset22, isCombining) : transforms.moveTo(offset22);
  const style2 = {
    position: "fixed",
    top: box.marginBox.top,
    left: box.marginBox.left,
    boxSizing: "border-box",
    width: box.borderBox.width,
    height: box.borderBox.height,
    transition: getDraggingTransition(shouldAnimate, dropping),
    transform,
    opacity: getDraggingOpacity(isCombining, isDropAnimating),
    zIndex: isDropAnimating ? zIndexOptions.dropAnimating : zIndexOptions.dragging,
    pointerEvents: "none"
  };
  return style2;
}
__name(getDraggingStyle, "getDraggingStyle");
function getSecondaryStyle(secondary) {
  return {
    transform: transforms.moveTo(secondary.offset),
    transition: secondary.shouldAnimateDisplacement ? void 0 : "none"
  };
}
__name(getSecondaryStyle, "getSecondaryStyle");
function getStyle$1(mapped) {
  return mapped.type === "DRAGGING" ? getDraggingStyle(mapped) : getSecondaryStyle(mapped);
}
__name(getStyle$1, "getStyle$1");
function getDimension$1(descriptor, el, windowScroll = origin) {
  const computedStyles = window.getComputedStyle(el);
  const borderBox = el.getBoundingClientRect();
  const client = calculateBox(borderBox, computedStyles);
  const page = withScroll(client, windowScroll);
  const placeholder2 = {
    client,
    tagName: el.tagName.toLowerCase(),
    display: computedStyles.display
  };
  const displaceBy = {
    x: client.marginBox.width,
    y: client.marginBox.height
  };
  const dimension = {
    descriptor,
    placeholder: placeholder2,
    displaceBy,
    client,
    page
  };
  return dimension;
}
__name(getDimension$1, "getDimension$1");
function useDraggablePublisher(args) {
  const uniqueId = useUniqueId("draggable");
  const {
    descriptor,
    registry,
    getDraggableRef,
    canDragInteractiveElements,
    shouldRespectForcePress,
    isEnabled
  } = args;
  const options = useMemo(() => ({
    canDragInteractiveElements,
    shouldRespectForcePress,
    isEnabled
  }), [canDragInteractiveElements, isEnabled, shouldRespectForcePress]);
  const getDimension2 = useCallback((windowScroll) => {
    const el = getDraggableRef();
    !el ? invariant() : void 0;
    return getDimension$1(descriptor, el, windowScroll);
  }, [descriptor, getDraggableRef]);
  const entry = useMemo(() => ({
    uniqueId,
    descriptor,
    options,
    getDimension: getDimension2
  }), [descriptor, getDimension2, options, uniqueId]);
  const publishedRef = reactExports.useRef(entry);
  const isFirstPublishRef = reactExports.useRef(true);
  useIsomorphicLayoutEffect(() => {
    registry.draggable.register(publishedRef.current);
    return () => registry.draggable.unregister(publishedRef.current);
  }, [registry.draggable]);
  useIsomorphicLayoutEffect(() => {
    if (isFirstPublishRef.current) {
      isFirstPublishRef.current = false;
      return;
    }
    const last = publishedRef.current;
    publishedRef.current = entry;
    registry.draggable.update(entry, last);
  }, [entry, registry.draggable]);
}
__name(useDraggablePublisher, "useDraggablePublisher");
var DroppableContext = React.createContext(null);
function useRequiredContext(Context) {
  const result = reactExports.useContext(Context);
  !result ? invariant() : void 0;
  return result;
}
__name(useRequiredContext, "useRequiredContext");
function preventHtml5Dnd(event) {
  event.preventDefault();
}
__name(preventHtml5Dnd, "preventHtml5Dnd");
const Draggable = /* @__PURE__ */ __name((props) => {
  const ref2 = reactExports.useRef(null);
  const setRef = useCallback((el = null) => {
    ref2.current = el;
  }, []);
  const getRef = useCallback(() => ref2.current, []);
  const {
    contextId,
    dragHandleUsageInstructionsId,
    registry
  } = useRequiredContext(AppContext);
  const {
    type,
    droppableId
  } = useRequiredContext(DroppableContext);
  const descriptor = useMemo(() => ({
    id: props.draggableId,
    index: props.index,
    type,
    droppableId
  }), [props.draggableId, props.index, type, droppableId]);
  const {
    children,
    draggableId,
    isEnabled,
    shouldRespectForcePress,
    canDragInteractiveElements,
    isClone,
    mapped,
    dropAnimationFinished: dropAnimationFinishedAction
  } = props;
  if (!isClone) {
    const forPublisher = useMemo(() => ({
      descriptor,
      registry,
      getDraggableRef: getRef,
      canDragInteractiveElements,
      shouldRespectForcePress,
      isEnabled
    }), [descriptor, registry, getRef, canDragInteractiveElements, shouldRespectForcePress, isEnabled]);
    useDraggablePublisher(forPublisher);
  }
  const dragHandleProps = useMemo(() => isEnabled ? {
    tabIndex: 0,
    role: "button",
    "aria-describedby": dragHandleUsageInstructionsId,
    "data-rfd-drag-handle-draggable-id": draggableId,
    "data-rfd-drag-handle-context-id": contextId,
    draggable: false,
    onDragStart: preventHtml5Dnd
  } : null, [contextId, dragHandleUsageInstructionsId, draggableId, isEnabled]);
  const onMoveEnd = useCallback((event) => {
    if (mapped.type !== "DRAGGING") {
      return;
    }
    if (!mapped.dropping) {
      return;
    }
    if (event.propertyName !== "transform") {
      return;
    }
    reactDomExports.flushSync(dropAnimationFinishedAction);
  }, [dropAnimationFinishedAction, mapped]);
  const provided = useMemo(() => {
    const style2 = getStyle$1(mapped);
    const onTransitionEnd = mapped.type === "DRAGGING" && mapped.dropping ? onMoveEnd : void 0;
    const result = {
      innerRef: setRef,
      draggableProps: {
        "data-rfd-draggable-context-id": contextId,
        "data-rfd-draggable-id": draggableId,
        style: style2,
        onTransitionEnd
      },
      dragHandleProps
    };
    return result;
  }, [contextId, dragHandleProps, draggableId, mapped, onMoveEnd, setRef]);
  const rubric = useMemo(() => ({
    draggableId: descriptor.id,
    type: descriptor.type,
    source: {
      index: descriptor.index,
      droppableId: descriptor.droppableId
    }
  }), [descriptor.droppableId, descriptor.id, descriptor.index, descriptor.type]);
  return React.createElement(React.Fragment, null, children(provided, mapped.snapshot, rubric));
}, "Draggable");
var isStrictEqual = /* @__PURE__ */ __name((a, b) => a === b, "isStrictEqual");
var whatIsDraggedOverFromResult = /* @__PURE__ */ __name((result) => {
  const {
    combine: combine2,
    destination
  } = result;
  if (destination) {
    return destination.droppableId;
  }
  if (combine2) {
    return combine2.droppableId;
  }
  return null;
}, "whatIsDraggedOverFromResult");
const getCombineWithFromResult = /* @__PURE__ */ __name((result) => {
  return result.combine ? result.combine.draggableId : null;
}, "getCombineWithFromResult");
const getCombineWithFromImpact = /* @__PURE__ */ __name((impact) => {
  return impact.at && impact.at.type === "COMBINE" ? impact.at.combine.draggableId : null;
}, "getCombineWithFromImpact");
function getDraggableSelector() {
  const memoizedOffset = memoizeOne((x, y) => ({
    x,
    y
  }));
  const getMemoizedSnapshot = memoizeOne((mode, isClone, draggingOver = null, combineWith = null, dropping = null) => ({
    isDragging: true,
    isClone,
    isDropAnimating: Boolean(dropping),
    dropAnimation: dropping,
    mode,
    draggingOver,
    combineWith,
    combineTargetFor: null
  }));
  const getMemoizedProps = memoizeOne((offset22, mode, dimension, isClone, draggingOver = null, combineWith = null, forceShouldAnimate = null) => ({
    mapped: {
      type: "DRAGGING",
      dropping: null,
      draggingOver,
      combineWith,
      mode,
      offset: offset22,
      dimension,
      forceShouldAnimate,
      snapshot: getMemoizedSnapshot(mode, isClone, draggingOver, combineWith, null)
    }
  }));
  const selector = /* @__PURE__ */ __name((state, ownProps) => {
    if (isDragging(state)) {
      if (state.critical.draggable.id !== ownProps.draggableId) {
        return null;
      }
      const offset22 = state.current.client.offset;
      const dimension = state.dimensions.draggables[ownProps.draggableId];
      const draggingOver = whatIsDraggedOver(state.impact);
      const combineWith = getCombineWithFromImpact(state.impact);
      const forceShouldAnimate = state.forceShouldAnimate;
      return getMemoizedProps(memoizedOffset(offset22.x, offset22.y), state.movementMode, dimension, ownProps.isClone, draggingOver, combineWith, forceShouldAnimate);
    }
    if (state.phase === "DROP_ANIMATING") {
      const completed = state.completed;
      if (completed.result.draggableId !== ownProps.draggableId) {
        return null;
      }
      const isClone = ownProps.isClone;
      const dimension = state.dimensions.draggables[ownProps.draggableId];
      const result = completed.result;
      const mode = result.mode;
      const draggingOver = whatIsDraggedOverFromResult(result);
      const combineWith = getCombineWithFromResult(result);
      const duration = state.dropDuration;
      const dropping = {
        duration,
        curve: curves.drop,
        moveTo: state.newHomeClientOffset,
        opacity: combineWith ? combine.opacity.drop : null,
        scale: combineWith ? combine.scale.drop : null
      };
      return {
        mapped: {
          type: "DRAGGING",
          offset: state.newHomeClientOffset,
          dimension,
          dropping,
          draggingOver,
          combineWith,
          mode,
          forceShouldAnimate: null,
          snapshot: getMemoizedSnapshot(mode, isClone, draggingOver, combineWith, dropping)
        }
      };
    }
    return null;
  }, "selector");
  return selector;
}
__name(getDraggableSelector, "getDraggableSelector");
function getSecondarySnapshot(combineTargetFor = null) {
  return {
    isDragging: false,
    isDropAnimating: false,
    isClone: false,
    dropAnimation: null,
    mode: null,
    draggingOver: null,
    combineTargetFor,
    combineWith: null
  };
}
__name(getSecondarySnapshot, "getSecondarySnapshot");
const atRest = {
  mapped: {
    type: "SECONDARY",
    offset: origin,
    combineTargetFor: null,
    shouldAnimateDisplacement: true,
    snapshot: getSecondarySnapshot(null)
  }
};
function getSecondarySelector() {
  const memoizedOffset = memoizeOne((x, y) => ({
    x,
    y
  }));
  const getMemoizedSnapshot = memoizeOne(getSecondarySnapshot);
  const getMemoizedProps = memoizeOne((offset22, combineTargetFor = null, shouldAnimateDisplacement) => ({
    mapped: {
      type: "SECONDARY",
      offset: offset22,
      combineTargetFor,
      shouldAnimateDisplacement,
      snapshot: getMemoizedSnapshot(combineTargetFor)
    }
  }));
  const getFallback = /* @__PURE__ */ __name((combineTargetFor) => {
    return combineTargetFor ? getMemoizedProps(origin, combineTargetFor, true) : null;
  }, "getFallback");
  const getProps = /* @__PURE__ */ __name((ownId, draggingId, impact, afterCritical) => {
    const visualDisplacement = impact.displaced.visible[ownId];
    const isAfterCriticalInVirtualList = Boolean(afterCritical.inVirtualList && afterCritical.effected[ownId]);
    const combine2 = tryGetCombine(impact);
    const combineTargetFor = combine2 && combine2.draggableId === ownId ? draggingId : null;
    if (!visualDisplacement) {
      if (!isAfterCriticalInVirtualList) {
        return getFallback(combineTargetFor);
      }
      if (impact.displaced.invisible[ownId]) {
        return null;
      }
      const change = negate(afterCritical.displacedBy.point);
      const offset3 = memoizedOffset(change.x, change.y);
      return getMemoizedProps(offset3, combineTargetFor, true);
    }
    if (isAfterCriticalInVirtualList) {
      return getFallback(combineTargetFor);
    }
    const displaceBy = impact.displacedBy.point;
    const offset22 = memoizedOffset(displaceBy.x, displaceBy.y);
    return getMemoizedProps(offset22, combineTargetFor, visualDisplacement.shouldAnimate);
  }, "getProps");
  const selector = /* @__PURE__ */ __name((state, ownProps) => {
    if (isDragging(state)) {
      if (state.critical.draggable.id === ownProps.draggableId) {
        return null;
      }
      return getProps(ownProps.draggableId, state.critical.draggable.id, state.impact, state.afterCritical);
    }
    if (state.phase === "DROP_ANIMATING") {
      const completed = state.completed;
      if (completed.result.draggableId === ownProps.draggableId) {
        return null;
      }
      return getProps(ownProps.draggableId, completed.result.draggableId, completed.impact, completed.afterCritical);
    }
    return null;
  }, "selector");
  return selector;
}
__name(getSecondarySelector, "getSecondarySelector");
const makeMapStateToProps$1 = /* @__PURE__ */ __name(() => {
  const draggingSelector = getDraggableSelector();
  const secondarySelector = getSecondarySelector();
  const selector = /* @__PURE__ */ __name((state, ownProps) => draggingSelector(state, ownProps) || secondarySelector(state, ownProps) || atRest, "selector");
  return selector;
}, "makeMapStateToProps$1");
const mapDispatchToProps$1 = {
  dropAnimationFinished
};
const ConnectedDraggable = connect_default(makeMapStateToProps$1, mapDispatchToProps$1, null, {
  context: StoreContext,
  areStatePropsEqual: isStrictEqual
})(Draggable);
function PrivateDraggable(props) {
  const droppableContext = useRequiredContext(DroppableContext);
  const isUsingCloneFor = droppableContext.isUsingCloneFor;
  if (isUsingCloneFor === props.draggableId && !props.isClone) {
    return null;
  }
  return React.createElement(ConnectedDraggable, props);
}
__name(PrivateDraggable, "PrivateDraggable");
function PublicDraggable(props) {
  const isEnabled = typeof props.isDragDisabled === "boolean" ? !props.isDragDisabled : true;
  const canDragInteractiveElements = Boolean(props.disableInteractiveElementBlocking);
  const shouldRespectForcePress = Boolean(props.shouldRespectForcePress);
  return React.createElement(PrivateDraggable, _extends({}, props, {
    isClone: false,
    isEnabled,
    canDragInteractiveElements,
    shouldRespectForcePress
  }));
}
__name(PublicDraggable, "PublicDraggable");
const isEqual = /* @__PURE__ */ __name((base) => (value) => base === value, "isEqual");
const isScroll = isEqual("scroll");
const isAuto = isEqual("auto");
const isEither = /* @__PURE__ */ __name((overflow, fn) => fn(overflow.overflowX) || fn(overflow.overflowY), "isEither");
const isElementScrollable = /* @__PURE__ */ __name((el) => {
  const style2 = window.getComputedStyle(el);
  const overflow = {
    overflowX: style2.overflowX,
    overflowY: style2.overflowY
  };
  return isEither(overflow, isScroll) || isEither(overflow, isAuto);
}, "isElementScrollable");
const isBodyScrollable = /* @__PURE__ */ __name(() => {
  {
    return false;
  }
}, "isBodyScrollable");
const getClosestScrollable = /* @__PURE__ */ __name((el) => {
  if (el == null) {
    return null;
  }
  if (el === document.body) {
    return isBodyScrollable() ? el : null;
  }
  if (el === document.documentElement) {
    return null;
  }
  if (!isElementScrollable(el)) {
    return getClosestScrollable(el.parentElement);
  }
  return el;
}, "getClosestScrollable");
var getScroll = /* @__PURE__ */ __name((el) => ({
  x: el.scrollLeft,
  y: el.scrollTop
}), "getScroll");
const getIsFixed = /* @__PURE__ */ __name((el) => {
  if (!el) {
    return false;
  }
  const style2 = window.getComputedStyle(el);
  if (style2.position === "fixed") {
    return true;
  }
  return getIsFixed(el.parentElement);
}, "getIsFixed");
var getEnv = /* @__PURE__ */ __name((start2) => {
  const closestScrollable = getClosestScrollable(start2);
  const isFixedOnPage = getIsFixed(start2);
  return {
    closestScrollable,
    isFixedOnPage
  };
}, "getEnv");
var getDroppableDimension = /* @__PURE__ */ __name(({
  descriptor,
  isEnabled,
  isCombineEnabled,
  isFixedOnPage,
  direction,
  client,
  page,
  closest: closest2
}) => {
  const frame = (() => {
    if (!closest2) {
      return null;
    }
    const {
      scrollSize,
      client: frameClient
    } = closest2;
    const maxScroll = getMaxScroll({
      scrollHeight: scrollSize.scrollHeight,
      scrollWidth: scrollSize.scrollWidth,
      height: frameClient.paddingBox.height,
      width: frameClient.paddingBox.width
    });
    return {
      pageMarginBox: closest2.page.marginBox,
      frameClient,
      scrollSize,
      shouldClipSubject: closest2.shouldClipSubject,
      scroll: {
        initial: closest2.scroll,
        current: closest2.scroll,
        max: maxScroll,
        diff: {
          value: origin,
          displacement: origin
        }
      }
    };
  })();
  const axis = direction === "vertical" ? vertical : horizontal;
  const subject = getSubject({
    page,
    withPlaceholder: null,
    axis,
    frame
  });
  const dimension = {
    descriptor,
    isCombineEnabled,
    isFixedOnPage,
    axis,
    isEnabled,
    client,
    page,
    frame,
    subject
  };
  return dimension;
}, "getDroppableDimension");
const getClient = /* @__PURE__ */ __name((targetRef, closestScrollable) => {
  const base = getBox(targetRef);
  if (!closestScrollable) {
    return base;
  }
  if (targetRef !== closestScrollable) {
    return base;
  }
  const top = base.paddingBox.top - closestScrollable.scrollTop;
  const left = base.paddingBox.left - closestScrollable.scrollLeft;
  const bottom = top + closestScrollable.scrollHeight;
  const right = left + closestScrollable.scrollWidth;
  const paddingBox = {
    top,
    right,
    bottom,
    left
  };
  const borderBox = expand(paddingBox, base.border);
  const client = createBox({
    borderBox,
    margin: base.margin,
    border: base.border,
    padding: base.padding
  });
  return client;
}, "getClient");
var getDimension = /* @__PURE__ */ __name(({
  ref: ref2,
  descriptor,
  env,
  windowScroll,
  direction,
  isDropDisabled,
  isCombineEnabled,
  shouldClipSubject
}) => {
  const closestScrollable = env.closestScrollable;
  const client = getClient(ref2, closestScrollable);
  const page = withScroll(client, windowScroll);
  const closest2 = (() => {
    if (!closestScrollable) {
      return null;
    }
    const frameClient = getBox(closestScrollable);
    const scrollSize = {
      scrollHeight: closestScrollable.scrollHeight,
      scrollWidth: closestScrollable.scrollWidth
    };
    return {
      client: frameClient,
      page: withScroll(frameClient, windowScroll),
      scroll: getScroll(closestScrollable),
      scrollSize,
      shouldClipSubject
    };
  })();
  const dimension = getDroppableDimension({
    descriptor,
    isEnabled: !isDropDisabled,
    isCombineEnabled,
    isFixedOnPage: env.isFixedOnPage,
    direction,
    client,
    page,
    closest: closest2
  });
  return dimension;
}, "getDimension");
const immediate = {
  passive: false
};
const delayed = {
  passive: true
};
var getListenerOptions = /* @__PURE__ */ __name((options) => options.shouldPublishImmediately ? immediate : delayed, "getListenerOptions");
const getClosestScrollableFromDrag = /* @__PURE__ */ __name((dragging) => dragging && dragging.env.closestScrollable || null, "getClosestScrollableFromDrag");
function useDroppablePublisher(args) {
  const whileDraggingRef = reactExports.useRef(null);
  const appContext = useRequiredContext(AppContext);
  const uniqueId = useUniqueId("droppable");
  const {
    registry,
    marshal
  } = appContext;
  const previousRef = usePrevious(args);
  const descriptor = useMemo(() => ({
    id: args.droppableId,
    type: args.type,
    mode: args.mode
  }), [args.droppableId, args.mode, args.type]);
  const publishedDescriptorRef = reactExports.useRef(descriptor);
  const memoizedUpdateScroll = useMemo(() => memoizeOne((x, y) => {
    !whileDraggingRef.current ? invariant() : void 0;
    const scroll3 = {
      x,
      y
    };
    marshal.updateDroppableScroll(descriptor.id, scroll3);
  }), [descriptor.id, marshal]);
  const getClosestScroll = useCallback(() => {
    const dragging = whileDraggingRef.current;
    if (!dragging || !dragging.env.closestScrollable) {
      return origin;
    }
    return getScroll(dragging.env.closestScrollable);
  }, []);
  const updateScroll = useCallback(() => {
    const scroll3 = getClosestScroll();
    memoizedUpdateScroll(scroll3.x, scroll3.y);
  }, [getClosestScroll, memoizedUpdateScroll]);
  const scheduleScrollUpdate = useMemo(() => rafSchd(updateScroll), [updateScroll]);
  const onClosestScroll = useCallback(() => {
    const dragging = whileDraggingRef.current;
    const closest2 = getClosestScrollableFromDrag(dragging);
    !(dragging && closest2) ? invariant() : void 0;
    const options = dragging.scrollOptions;
    if (options.shouldPublishImmediately) {
      updateScroll();
      return;
    }
    scheduleScrollUpdate();
  }, [scheduleScrollUpdate, updateScroll]);
  const getDimensionAndWatchScroll = useCallback((windowScroll, options) => {
    !!whileDraggingRef.current ? invariant() : void 0;
    const previous = previousRef.current;
    const ref2 = previous.getDroppableRef();
    !ref2 ? invariant() : void 0;
    const env = getEnv(ref2);
    const dragging = {
      ref: ref2,
      descriptor,
      env,
      scrollOptions: options
    };
    whileDraggingRef.current = dragging;
    const dimension = getDimension({
      ref: ref2,
      descriptor,
      env,
      windowScroll,
      direction: previous.direction,
      isDropDisabled: previous.isDropDisabled,
      isCombineEnabled: previous.isCombineEnabled,
      shouldClipSubject: !previous.ignoreContainerClipping
    });
    const scrollable = env.closestScrollable;
    if (scrollable) {
      scrollable.setAttribute(scrollContainer.contextId, appContext.contextId);
      scrollable.addEventListener("scroll", onClosestScroll, getListenerOptions(dragging.scrollOptions));
    }
    return dimension;
  }, [appContext.contextId, descriptor, onClosestScroll, previousRef]);
  const getScrollWhileDragging = useCallback(() => {
    const dragging = whileDraggingRef.current;
    const closest2 = getClosestScrollableFromDrag(dragging);
    !(dragging && closest2) ? invariant() : void 0;
    return getScroll(closest2);
  }, []);
  const dragStopped = useCallback(() => {
    const dragging = whileDraggingRef.current;
    !dragging ? invariant() : void 0;
    const closest2 = getClosestScrollableFromDrag(dragging);
    whileDraggingRef.current = null;
    if (!closest2) {
      return;
    }
    scheduleScrollUpdate.cancel();
    closest2.removeAttribute(scrollContainer.contextId);
    closest2.removeEventListener("scroll", onClosestScroll, getListenerOptions(dragging.scrollOptions));
  }, [onClosestScroll, scheduleScrollUpdate]);
  const scroll2 = useCallback((change) => {
    const dragging = whileDraggingRef.current;
    !dragging ? invariant() : void 0;
    const closest2 = getClosestScrollableFromDrag(dragging);
    !closest2 ? invariant() : void 0;
    closest2.scrollTop += change.y;
    closest2.scrollLeft += change.x;
  }, []);
  const callbacks = useMemo(() => {
    return {
      getDimensionAndWatchScroll,
      getScrollWhileDragging,
      dragStopped,
      scroll: scroll2
    };
  }, [dragStopped, getDimensionAndWatchScroll, getScrollWhileDragging, scroll2]);
  const entry = useMemo(() => ({
    uniqueId,
    descriptor,
    callbacks
  }), [callbacks, descriptor, uniqueId]);
  useIsomorphicLayoutEffect(() => {
    publishedDescriptorRef.current = entry.descriptor;
    registry.droppable.register(entry);
    return () => {
      if (whileDraggingRef.current) {
        dragStopped();
      }
      registry.droppable.unregister(entry);
    };
  }, [callbacks, descriptor, dragStopped, entry, marshal, registry.droppable]);
  useIsomorphicLayoutEffect(() => {
    if (!whileDraggingRef.current) {
      return;
    }
    marshal.updateDroppableIsEnabled(publishedDescriptorRef.current.id, !args.isDropDisabled);
  }, [args.isDropDisabled, marshal]);
  useIsomorphicLayoutEffect(() => {
    if (!whileDraggingRef.current) {
      return;
    }
    marshal.updateDroppableIsCombineEnabled(publishedDescriptorRef.current.id, args.isCombineEnabled);
  }, [args.isCombineEnabled, marshal]);
}
__name(useDroppablePublisher, "useDroppablePublisher");
function noop() {
}
__name(noop, "noop");
const empty = {
  width: 0,
  height: 0,
  margin: noSpacing
};
const getSize = /* @__PURE__ */ __name(({
  isAnimatingOpenOnMount,
  placeholder: placeholder2,
  animate
}) => {
  if (isAnimatingOpenOnMount) {
    return empty;
  }
  if (animate === "close") {
    return empty;
  }
  return {
    height: placeholder2.client.borderBox.height,
    width: placeholder2.client.borderBox.width,
    margin: placeholder2.client.margin
  };
}, "getSize");
const getStyle = /* @__PURE__ */ __name(({
  isAnimatingOpenOnMount,
  placeholder: placeholder2,
  animate
}) => {
  const size = getSize({
    isAnimatingOpenOnMount,
    placeholder: placeholder2,
    animate
  });
  return {
    display: placeholder2.display,
    boxSizing: "border-box",
    width: size.width,
    height: size.height,
    marginTop: size.margin.top,
    marginRight: size.margin.right,
    marginBottom: size.margin.bottom,
    marginLeft: size.margin.left,
    flexShrink: "0",
    flexGrow: "0",
    pointerEvents: "none",
    transition: animate !== "none" ? transitions.placeholder : null
  };
}, "getStyle");
const Placeholder = /* @__PURE__ */ __name((props) => {
  const animateOpenTimerRef = reactExports.useRef(null);
  const tryClearAnimateOpenTimer = useCallback(() => {
    if (!animateOpenTimerRef.current) {
      return;
    }
    clearTimeout(animateOpenTimerRef.current);
    animateOpenTimerRef.current = null;
  }, []);
  const {
    animate,
    onTransitionEnd,
    onClose,
    contextId
  } = props;
  const [isAnimatingOpenOnMount, setIsAnimatingOpenOnMount] = reactExports.useState(props.animate === "open");
  reactExports.useEffect(() => {
    if (!isAnimatingOpenOnMount) {
      return noop;
    }
    if (animate !== "open") {
      tryClearAnimateOpenTimer();
      setIsAnimatingOpenOnMount(false);
      return noop;
    }
    if (animateOpenTimerRef.current) {
      return noop;
    }
    animateOpenTimerRef.current = setTimeout(() => {
      animateOpenTimerRef.current = null;
      setIsAnimatingOpenOnMount(false);
    });
    return tryClearAnimateOpenTimer;
  }, [animate, isAnimatingOpenOnMount, tryClearAnimateOpenTimer]);
  const onSizeChangeEnd = useCallback((event) => {
    if (event.propertyName !== "height") {
      return;
    }
    onTransitionEnd();
    if (animate === "close") {
      onClose();
    }
  }, [animate, onClose, onTransitionEnd]);
  const style2 = getStyle({
    isAnimatingOpenOnMount,
    animate: props.animate,
    placeholder: props.placeholder
  });
  return React.createElement(props.placeholder.tagName, {
    style: style2,
    "data-rfd-placeholder-context-id": contextId,
    onTransitionEnd: onSizeChangeEnd,
    ref: props.innerRef
  });
}, "Placeholder");
var Placeholder$1 = React.memo(Placeholder);
const _AnimateInOut = class _AnimateInOut extends React.PureComponent {
  constructor(...args) {
    super(...args);
    this.state = {
      isVisible: Boolean(this.props.on),
      data: this.props.on,
      animate: this.props.shouldAnimate && this.props.on ? "open" : "none"
    };
    this.onClose = () => {
      if (this.state.animate !== "close") {
        return;
      }
      this.setState({
        isVisible: false
      });
    };
  }
  static getDerivedStateFromProps(props, state) {
    if (!props.shouldAnimate) {
      return {
        isVisible: Boolean(props.on),
        data: props.on,
        animate: "none"
      };
    }
    if (props.on) {
      return {
        isVisible: true,
        data: props.on,
        animate: "open"
      };
    }
    if (state.isVisible) {
      return {
        isVisible: true,
        data: state.data,
        animate: "close"
      };
    }
    return {
      isVisible: false,
      animate: "close",
      data: null
    };
  }
  render() {
    if (!this.state.isVisible) {
      return null;
    }
    const provided = {
      onClose: this.onClose,
      data: this.state.data,
      animate: this.state.animate
    };
    return this.props.children(provided);
  }
};
__name(_AnimateInOut, "AnimateInOut");
let AnimateInOut = _AnimateInOut;
const Droppable = /* @__PURE__ */ __name((props) => {
  const appContext = reactExports.useContext(AppContext);
  !appContext ? invariant() : void 0;
  const {
    contextId,
    isMovementAllowed: isMovementAllowed2
  } = appContext;
  const droppableRef = reactExports.useRef(null);
  const placeholderRef = reactExports.useRef(null);
  const {
    children,
    droppableId,
    type,
    mode,
    direction,
    ignoreContainerClipping,
    isDropDisabled,
    isCombineEnabled,
    snapshot,
    useClone,
    updateViewportMaxScroll: updateViewportMaxScroll2,
    getContainerForClone
  } = props;
  const getDroppableRef = useCallback(() => droppableRef.current, []);
  const setDroppableRef = useCallback((value = null) => {
    droppableRef.current = value;
  }, []);
  useCallback(() => placeholderRef.current, []);
  const setPlaceholderRef = useCallback((value = null) => {
    placeholderRef.current = value;
  }, []);
  const onPlaceholderTransitionEnd = useCallback(() => {
    if (isMovementAllowed2()) {
      updateViewportMaxScroll2({
        maxScroll: getMaxWindowScroll()
      });
    }
  }, [isMovementAllowed2, updateViewportMaxScroll2]);
  useDroppablePublisher({
    droppableId,
    type,
    mode,
    direction,
    isDropDisabled,
    isCombineEnabled,
    ignoreContainerClipping,
    getDroppableRef
  });
  const placeholder2 = useMemo(() => React.createElement(AnimateInOut, {
    on: props.placeholder,
    shouldAnimate: props.shouldAnimatePlaceholder
  }, ({
    onClose,
    data,
    animate
  }) => React.createElement(Placeholder$1, {
    placeholder: data,
    onClose,
    innerRef: setPlaceholderRef,
    animate,
    contextId,
    onTransitionEnd: onPlaceholderTransitionEnd
  })), [contextId, onPlaceholderTransitionEnd, props.placeholder, props.shouldAnimatePlaceholder, setPlaceholderRef]);
  const provided = useMemo(() => ({
    innerRef: setDroppableRef,
    placeholder: placeholder2,
    droppableProps: {
      "data-rfd-droppable-id": droppableId,
      "data-rfd-droppable-context-id": contextId
    }
  }), [contextId, droppableId, placeholder2, setDroppableRef]);
  const isUsingCloneFor = useClone ? useClone.dragging.draggableId : null;
  const droppableContext = useMemo(() => ({
    droppableId,
    type,
    isUsingCloneFor
  }), [droppableId, isUsingCloneFor, type]);
  function getClone() {
    if (!useClone) {
      return null;
    }
    const {
      dragging,
      render
    } = useClone;
    const node = React.createElement(PrivateDraggable, {
      draggableId: dragging.draggableId,
      index: dragging.source.index,
      isClone: true,
      isEnabled: true,
      shouldRespectForcePress: false,
      canDragInteractiveElements: true
    }, (draggableProvided, draggableSnapshot) => render(draggableProvided, draggableSnapshot, dragging));
    return ReactDOM.createPortal(node, getContainerForClone());
  }
  __name(getClone, "getClone");
  return React.createElement(DroppableContext.Provider, {
    value: droppableContext
  }, children(provided, snapshot), getClone());
}, "Droppable");
function getBody() {
  !document.body ? invariant() : void 0;
  return document.body;
}
__name(getBody, "getBody");
const defaultProps = {
  mode: "standard",
  type: "DEFAULT",
  direction: "vertical",
  isDropDisabled: false,
  isCombineEnabled: false,
  ignoreContainerClipping: false,
  renderClone: null,
  getContainerForClone: getBody
};
const attachDefaultPropsToOwnProps = /* @__PURE__ */ __name((ownProps) => {
  let mergedProps = {
    ...ownProps
  };
  let defaultPropKey;
  for (defaultPropKey in defaultProps) {
    if (ownProps[defaultPropKey] === void 0) {
      mergedProps = {
        ...mergedProps,
        [defaultPropKey]: defaultProps[defaultPropKey]
      };
    }
  }
  return mergedProps;
}, "attachDefaultPropsToOwnProps");
const isMatchingType = /* @__PURE__ */ __name((type, critical) => type === critical.droppable.type, "isMatchingType");
const getDraggable = /* @__PURE__ */ __name((critical, dimensions) => dimensions.draggables[critical.draggable.id], "getDraggable");
const makeMapStateToProps = /* @__PURE__ */ __name(() => {
  const idleWithAnimation = {
    placeholder: null,
    shouldAnimatePlaceholder: true,
    snapshot: {
      isDraggingOver: false,
      draggingOverWith: null,
      draggingFromThisWith: null,
      isUsingPlaceholder: false
    },
    useClone: null
  };
  const idleWithoutAnimation = {
    ...idleWithAnimation,
    shouldAnimatePlaceholder: false
  };
  const getDraggableRubric = memoizeOne((descriptor) => ({
    draggableId: descriptor.id,
    type: descriptor.type,
    source: {
      index: descriptor.index,
      droppableId: descriptor.droppableId
    }
  }));
  const getMapProps = memoizeOne((id, isEnabled, isDraggingOverForConsumer, isDraggingOverForImpact, dragging, renderClone) => {
    const draggableId = dragging.descriptor.id;
    const isHome = dragging.descriptor.droppableId === id;
    if (isHome) {
      const useClone = renderClone ? {
        render: renderClone,
        dragging: getDraggableRubric(dragging.descriptor)
      } : null;
      const snapshot2 = {
        isDraggingOver: isDraggingOverForConsumer,
        draggingOverWith: isDraggingOverForConsumer ? draggableId : null,
        draggingFromThisWith: draggableId,
        isUsingPlaceholder: true
      };
      return {
        placeholder: dragging.placeholder,
        shouldAnimatePlaceholder: false,
        snapshot: snapshot2,
        useClone
      };
    }
    if (!isEnabled) {
      return idleWithoutAnimation;
    }
    if (!isDraggingOverForImpact) {
      return idleWithAnimation;
    }
    const snapshot = {
      isDraggingOver: isDraggingOverForConsumer,
      draggingOverWith: draggableId,
      draggingFromThisWith: null,
      isUsingPlaceholder: true
    };
    return {
      placeholder: dragging.placeholder,
      shouldAnimatePlaceholder: true,
      snapshot,
      useClone: null
    };
  });
  const selector = /* @__PURE__ */ __name((state, ownProps) => {
    const ownPropsWithDefaultProps = attachDefaultPropsToOwnProps(ownProps);
    const id = ownPropsWithDefaultProps.droppableId;
    const type = ownPropsWithDefaultProps.type;
    const isEnabled = !ownPropsWithDefaultProps.isDropDisabled;
    const renderClone = ownPropsWithDefaultProps.renderClone;
    if (isDragging(state)) {
      const critical = state.critical;
      if (!isMatchingType(type, critical)) {
        return idleWithoutAnimation;
      }
      const dragging = getDraggable(critical, state.dimensions);
      const isDraggingOver = whatIsDraggedOver(state.impact) === id;
      return getMapProps(id, isEnabled, isDraggingOver, isDraggingOver, dragging, renderClone);
    }
    if (state.phase === "DROP_ANIMATING") {
      const completed = state.completed;
      if (!isMatchingType(type, completed.critical)) {
        return idleWithoutAnimation;
      }
      const dragging = getDraggable(completed.critical, state.dimensions);
      return getMapProps(id, isEnabled, whatIsDraggedOverFromResult(completed.result) === id, whatIsDraggedOver(completed.impact) === id, dragging, renderClone);
    }
    if (state.phase === "IDLE" && state.completed && !state.shouldFlush) {
      const completed = state.completed;
      if (!isMatchingType(type, completed.critical)) {
        return idleWithoutAnimation;
      }
      const wasOver = whatIsDraggedOver(completed.impact) === id;
      const wasCombining = Boolean(completed.impact.at && completed.impact.at.type === "COMBINE");
      const isHome = completed.critical.droppable.id === id;
      if (wasOver) {
        return wasCombining ? idleWithAnimation : idleWithoutAnimation;
      }
      if (isHome) {
        return idleWithAnimation;
      }
      return idleWithoutAnimation;
    }
    return idleWithoutAnimation;
  }, "selector");
  return selector;
}, "makeMapStateToProps");
const mapDispatchToProps = {
  updateViewportMaxScroll
};
const ConnectedDroppable = connect_default(makeMapStateToProps, mapDispatchToProps, (stateProps, dispatchProps, ownProps) => {
  return {
    ...attachDefaultPropsToOwnProps(ownProps),
    ...stateProps,
    ...dispatchProps
  };
}, {
  context: StoreContext,
  areStatePropsEqual: isStrictEqual
})(Droppable);
const DealCard = /* @__PURE__ */ __name(({ deal, index }) => {
  if (!deal) return null;
  return /* @__PURE__ */ jsxRuntimeExports.jsx(PublicDraggable, { draggableId: String(deal.id), index, children: /* @__PURE__ */ __name((provided, snapshot) => /* @__PURE__ */ jsxRuntimeExports.jsx(DealCardContent, { provided, snapshot, deal }), "children") });
}, "DealCard");
const DealCardContent = /* @__PURE__ */ __name(({
  provided,
  snapshot,
  deal
}) => {
  const { dealCategories, currency } = useConfigurationContext();
  const redirect = useRedirect();
  const handleClick = /* @__PURE__ */ __name(() => {
    redirect(`/deals/${deal.id}/show`, void 0, void 0, void 0, {
      _scrollToTop: false
    });
  }, "handleClick");
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    "div",
    {
      className: "cursor-pointer",
      ...provided?.draggableProps,
      ...provided?.dragHandleProps,
      ref: provided?.innerRef,
      onClick: handleClick,
      children: /* @__PURE__ */ jsxRuntimeExports.jsx(RecordContextProvider, { value: deal, children: /* @__PURE__ */ jsxRuntimeExports.jsx(
        Card,
        {
          className: `py-3 transition-all duration-200 ${snapshot?.isDragging ? "opacity-90 transform rotate-1 shadow-lg" : "shadow-sm hover:shadow-md"}`,
          children: /* @__PURE__ */ jsxRuntimeExports.jsxs(CardContent, { className: "px-3 flex flex-col", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex-1 flex", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "flex-1 text-sm font-medium mb-2", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  ReferenceField,
                  {
                    source: "company_id",
                    reference: "companies",
                    link: false
                  }
                ),
                " - ",
                deal.name
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                ReferenceField,
                {
                  source: "company_id",
                  reference: "companies",
                  link: false,
                  children: /* @__PURE__ */ jsxRuntimeExports.jsx(CompanyAvatar, { width: 20, height: 20 })
                }
              )
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-xs text-muted-foreground", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                NumberField,
                {
                  source: "amount",
                  options: {
                    notation: "compact",
                    style: "currency",
                    currency,
                    currencyDisplay: "narrowSymbol",
                    minimumSignificantDigits: 3
                  }
                }
              ),
              deal.category && ", ",
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                SelectField,
                {
                  source: "category",
                  choices: dealCategories,
                  optionText: "label",
                  optionValue: "value"
                }
              )
            ] })
          ] })
        }
      ) })
    }
  );
}, "DealCardContent");
const DealArchivedList = /* @__PURE__ */ __name(() => {
  const translate = useTranslate();
  const [locale = "en"] = useLocaleState();
  const { identity } = useGetIdentity();
  const {
    data: archivedLists,
    total,
    isPending
  } = useGetList("deals", {
    pagination: { page: 1, perPage: 1e3 },
    sort: { field: "archived_at", order: "DESC" },
    filter: { "archived_at@not.is": null }
  });
  const [openDialog, setOpenDialog] = reactExports.useState(false);
  reactExports.useEffect(() => {
    if (!isPending && total === 0) {
      setOpenDialog(false);
    }
  }, [isPending, total]);
  reactExports.useEffect(() => {
    setOpenDialog(false);
  }, [archivedLists]);
  if (!identity || isPending || !total || !archivedLists) return null;
  const archivedListsByDate = archivedLists.reduce(
    (acc, deal) => {
      const date = new Date(deal.archived_at).toDateString();
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(deal);
      return acc;
    },
    {}
  );
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "w-full flex flex-row items-center justify-center", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      Button,
      {
        variant: "ghost",
        onClick: /* @__PURE__ */ __name(() => setOpenDialog(true), "onClick"),
        className: "my-4",
        children: translate("resources.deals.archived.view")
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx(Dialog, { open: openDialog, onOpenChange: /* @__PURE__ */ __name(() => setOpenDialog(false), "onOpenChange"), children: /* @__PURE__ */ jsxRuntimeExports.jsxs(DialogContent, { className: "lg:max-w-4xl overflow-y-auto max-h-9/10 top-1/20 translate-y-0", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(DialogTitle, { children: translate("resources.deals.archived.list_title") }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex flex-col gap-8", children: Object.entries(archivedListsByDate).map(([date, deals]) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-4", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { className: "font-bold", children: getRelativeTimeString(date, locale) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8", children: deals.map((deal) => /* @__PURE__ */ jsxRuntimeExports.jsx("div", { children: /* @__PURE__ */ jsxRuntimeExports.jsx(DealCardContent, { deal }) }, deal.id)) })
      ] }, date)) })
    ] }) })
  ] });
}, "DealArchivedList");
const DealInputs = /* @__PURE__ */ __name(() => {
  const isMobile = useIsMobile();
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-8", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(DealInfoInputs, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: `flex gap-6 ${isMobile ? "flex-col" : "flex-row"}`, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(DealLinkedToInputs, {}),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Separator, { orientation: isMobile ? "horizontal" : "vertical" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(DealMiscInputs, {})
    ] })
  ] });
}, "DealInputs");
const DealInfoInputs = /* @__PURE__ */ __name(() => {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-4 flex-1", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(TextInput, { source: "name", validate: required(), helperText: false }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(TextInput, { source: "description", multiline: true, rows: 3, helperText: false })
  ] });
}, "DealInfoInputs");
const DealLinkedToInputs = /* @__PURE__ */ __name(() => {
  const translate = useTranslate();
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-4 flex-1", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "text-base font-medium", children: translate("resources.deals.inputs.linked_to") }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(ReferenceInput, { source: "company_id", reference: "companies", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
      AutocompleteCompanyInput,
      {
        label: "resources.deals.fields.company_id",
        validate: required(),
        modal: true
      }
    ) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(ReferenceArrayInput, { source: "contact_ids", reference: "contacts_summary", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
      AutocompleteArrayInput,
      {
        label: "resources.deals.fields.contact_ids",
        optionText: contactOptionText,
        helperText: false
      }
    ) })
  ] });
}, "DealLinkedToInputs");
const DealMiscInputs = /* @__PURE__ */ __name(() => {
  const { dealStages, dealCategories } = useConfigurationContext();
  const translate = useTranslate();
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-4 flex-1", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "text-base font-medium", children: translate("resources.deals.field_categories.misc") }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      SelectInput,
      {
        source: "category",
        choices: dealCategories,
        optionText: "label",
        optionValue: "value",
        helperText: false
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      NumberInput,
      {
        source: "amount",
        defaultValue: 0,
        helperText: false,
        validate: required()
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      DateInput,
      {
        validate: required(),
        source: "expected_closing_date",
        helperText: false,
        defaultValue: (/* @__PURE__ */ new Date()).toISOString().split("T")[0]
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      SelectInput,
      {
        source: "stage",
        choices: dealStages,
        optionText: "label",
        optionValue: "value",
        defaultValue: "opportunity",
        helperText: false,
        validate: required()
      }
    )
  ] });
}, "DealMiscInputs");
const DealCreate = /* @__PURE__ */ __name(({ open }) => {
  const redirect = useRedirect();
  const dataProvider = useDataProvider();
  const { data: allDeals } = useListContext();
  const handleClose = /* @__PURE__ */ __name(() => {
    redirect("/deals");
  }, "handleClose");
  const queryClient = useQueryClient();
  const onSuccess = /* @__PURE__ */ __name(async (deal) => {
    if (!allDeals) {
      redirect("/deals");
      return;
    }
    const deals = allDeals.filter(
      (d) => d.stage === deal.stage && d.id !== deal.id
    );
    await Promise.all(
      deals.map(
        async (oldDeal) => dataProvider.update("deals", {
          id: oldDeal.id,
          data: { index: oldDeal.index + 1 },
          previousData: oldDeal
        })
      )
    );
    const dealsById = deals.reduce(
      (acc, d) => ({
        ...acc,
        [d.id]: { ...d, index: d.index + 1 }
      }),
      {}
    );
    const now = Date.now();
    queryClient.setQueriesData(
      { queryKey: ["deals", "getList"] },
      (res) => {
        if (!res) return res;
        return {
          ...res,
          data: res.data.map((d) => dealsById[d.id] || d)
        };
      },
      { updatedAt: now }
    );
    redirect("/deals");
  }, "onSuccess");
  const { identity } = useGetIdentity();
  return /* @__PURE__ */ jsxRuntimeExports.jsx(Dialog, { open, onOpenChange: /* @__PURE__ */ __name(() => handleClose(), "onOpenChange"), children: /* @__PURE__ */ jsxRuntimeExports.jsx(DialogContent, { className: "lg:max-w-4xl overflow-y-auto max-h-9/10 top-1/20 translate-y-0", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Create, { resource: "deals", mutationOptions: { onSuccess }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
    Form,
    {
      defaultValues: {
        sales_id: identity?.id,
        contact_ids: [],
        index: 0
      },
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(DealInputs, {}),
        /* @__PURE__ */ jsxRuntimeExports.jsx(FormToolbar, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(SaveButton, {}) })
      ]
    }
  ) }) }) });
}, "DealCreate");
const DealEdit = /* @__PURE__ */ __name(({ open, id }) => {
  const redirect = useRedirect();
  const notify = useNotify();
  const handleClose = /* @__PURE__ */ __name(() => {
    redirect("/deals", void 0, void 0, void 0, {
      _scrollToTop: false
    });
  }, "handleClose");
  return /* @__PURE__ */ jsxRuntimeExports.jsx(Dialog, { open, onOpenChange: /* @__PURE__ */ __name(() => handleClose(), "onOpenChange"), children: /* @__PURE__ */ jsxRuntimeExports.jsx(DialogContent, { className: "lg:max-w-4xl p-4 overflow-y-auto max-h-9/10 top-1/20 translate-y-0", children: id ? /* @__PURE__ */ jsxRuntimeExports.jsxs(
    EditBase,
    {
      id,
      mutationMode: "pessimistic",
      mutationOptions: {
        onSuccess: /* @__PURE__ */ __name(() => {
          notify("resources.deals.updated", {});
          redirect(`/deals/${id}/show`, void 0, void 0, void 0, {
            _scrollToTop: false
          });
        }, "onSuccess")
      },
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(EditHeader, {}),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(Form, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(DealInputs, {}),
          /* @__PURE__ */ jsxRuntimeExports.jsx(FormToolbar$1, {})
        ] })
      ]
    }
  ) : null }) });
}, "DealEdit");
function EditHeader() {
  const translate = useTranslate();
  const { defaultTitle } = useEditContext();
  const deal = useRecordContext();
  if (!deal) {
    return null;
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsx(DialogTitle, { className: "pb-0", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex justify-between items-start mb-8", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-4", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(ReferenceField, { source: "company_id", reference: "companies", link: "show", children: /* @__PURE__ */ jsxRuntimeExports.jsx(CompanyAvatar, {}) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "text-2xl font-semibold", children: defaultTitle })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex gap-2 pr-12", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(DeleteButton, {}),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { asChild: true, variant: "outline", className: "h-9", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Link, { to: `/deals/${deal.id}/show`, children: translate("resources.deals.action.back_to_deal") }) })
    ] })
  ] }) });
}
__name(EditHeader, "EditHeader");
const DealEmpty = /* @__PURE__ */ __name(({ children }) => {
  const translate = useTranslate();
  const location = useLocation();
  const matchCreate = matchPath("/deals/create", location.pathname);
  const appbarHeight = useAppBarHeight();
  const { data: contacts, isPending: contactsLoading } = useGetList(
    "contacts",
    {
      pagination: { page: 1, perPage: 1 }
    }
  );
  if (contactsLoading) return /* @__PURE__ */ jsxRuntimeExports.jsx(Progress, { value: 50 });
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      className: "flex flex-col justify-center items-center gap-12",
      style: {
        height: `calc(100dvh - ${appbarHeight}px)`
      },
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "img",
          {
            src: "./img/empty.svg",
            alt: translate("resources.deals.empty.title")
          }
        ),
        contacts && contacts.length > 0 ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col items-center gap-0", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "text-lg font-bold", children: translate("resources.deals.empty.title") }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-center text-muted-foreground mb-4", children: translate("resources.deals.empty.description") })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex space-x-8", children: /* @__PURE__ */ jsxRuntimeExports.jsx(CreateButton, { label: "resources.deals.action.create" }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(DealCreate, { open: !!matchCreate }),
          children
        ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col items-center gap-0", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "text-lg font-bold", children: translate("resources.deals.empty.title") }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-sm text-center text-muted-foreground mb-4", children: [
            translate("resources.contacts.empty.description"),
            /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
            /* @__PURE__ */ jsxRuntimeExports.jsx(Link, { to: "/contacts/create", className: "hover:underline", children: translate("resources.contacts.action.add_first") }),
            " ",
            translate("resources.deals.empty.before_create")
          ] })
        ] })
      ]
    }
  );
}, "DealEmpty");
const DealColumn = /* @__PURE__ */ __name(({
  stage,
  deals
}) => {
  const totalAmount = deals.reduce((sum, deal) => sum + deal.amount, 0);
  const { dealStages, currency } = useConfigurationContext();
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex-1 pb-8", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col items-center", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "text-base font-medium", children: findDealLabel(dealStages, stage) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: totalAmount.toLocaleString("en-US", {
        notation: "compact",
        style: "currency",
        currency,
        currencyDisplay: "narrowSymbol",
        minimumSignificantDigits: 3
      }) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(ConnectedDroppable, { droppableId: stage, children: /* @__PURE__ */ __name((droppableProvided, snapshot) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        ref: droppableProvided.innerRef,
        ...droppableProvided.droppableProps,
        className: `flex flex-col rounded-2xl mt-2 gap-2 ${snapshot.isDraggingOver ? "bg-muted" : ""}`,
        children: [
          deals.map((deal, index) => /* @__PURE__ */ jsxRuntimeExports.jsx(DealCard, { deal, index }, deal.id)),
          droppableProvided.placeholder
        ]
      }
    ), "children") })
  ] });
}, "DealColumn");
const getDealsByStage = /* @__PURE__ */ __name((unorderedDeals, dealStages) => {
  if (!dealStages) return {};
  const dealsByStage = unorderedDeals.reduce(
    (acc, deal) => {
      const stage = dealStages.find((s) => s.value === deal.stage) ? deal.stage : dealStages[0].value;
      acc[stage].push(deal);
      return acc;
    },
    dealStages.reduce(
      (obj, stage) => ({ ...obj, [stage.value]: [] }),
      {}
    )
  );
  dealStages.forEach((stage) => {
    dealsByStage[stage.value] = dealsByStage[stage.value].sort(
      (recordA, recordB) => recordA.index - recordB.index
    );
  });
  return dealsByStage;
}, "getDealsByStage");
const DealListContent = /* @__PURE__ */ __name(() => {
  const { dealStages } = useConfigurationContext();
  const { data: unorderedDeals, isPending, refetch } = useListContext();
  const dataProvider = useDataProvider();
  const [dealsByStage, setDealsByStage] = reactExports.useState(
    getDealsByStage([], dealStages)
  );
  reactExports.useEffect(() => {
    if (unorderedDeals) {
      const newDealsByStage = getDealsByStage(unorderedDeals, dealStages);
      if (!isEqual$3(newDealsByStage, dealsByStage)) {
        setDealsByStage(newDealsByStage);
      }
    }
  }, [unorderedDeals]);
  if (isPending) return null;
  const onDragEnd2 = /* @__PURE__ */ __name((result) => {
    const { destination, source } = result;
    if (!destination) {
      return;
    }
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }
    const sourceStage = source.droppableId;
    const destinationStage = destination.droppableId;
    const sourceDeal = dealsByStage[sourceStage][source.index];
    const destinationDeal = dealsByStage[destinationStage][destination.index] ?? {
      stage: destinationStage,
      index: void 0
      // undefined if dropped after the last item
    };
    setDealsByStage(
      updateDealStageLocal(
        sourceDeal,
        { stage: sourceStage, index: source.index },
        { stage: destinationStage, index: destination.index },
        dealsByStage
      )
    );
    updateDealStage(sourceDeal, destinationDeal, dataProvider).then(() => {
      refetch();
    });
  }, "onDragEnd");
  return /* @__PURE__ */ jsxRuntimeExports.jsx(DragDropContext, { onDragEnd: onDragEnd2, children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex gap-4", children: dealStages.map((stage) => /* @__PURE__ */ jsxRuntimeExports.jsx(
    DealColumn,
    {
      stage: stage.value,
      deals: dealsByStage[stage.value]
    },
    stage.value
  )) }) });
}, "DealListContent");
const updateDealStageLocal = /* @__PURE__ */ __name((sourceDeal, source, destination, dealsByStage) => {
  if (source.stage === destination.stage) {
    const column = dealsByStage[source.stage];
    column.splice(source.index, 1);
    column.splice(destination.index ?? column.length + 1, 0, sourceDeal);
    return {
      ...dealsByStage,
      [destination.stage]: column
    };
  } else {
    const sourceColumn = dealsByStage[source.stage];
    const destinationColumn = dealsByStage[destination.stage];
    sourceColumn.splice(source.index, 1);
    destinationColumn.splice(
      destination.index ?? destinationColumn.length + 1,
      0,
      sourceDeal
    );
    return {
      ...dealsByStage,
      [source.stage]: sourceColumn,
      [destination.stage]: destinationColumn
    };
  }
}, "updateDealStageLocal");
const updateDealStage = /* @__PURE__ */ __name(async (source, destination, dataProvider) => {
  if (source.stage === destination.stage) {
    const { data: columnDeals } = await dataProvider.getList("deals", {
      sort: { field: "index", order: "ASC" },
      pagination: { page: 1, perPage: 100 },
      filter: { stage: source.stage }
    });
    const destinationIndex = destination.index ?? columnDeals.length + 1;
    if (source.index > destinationIndex) {
      await Promise.all([
        // for all deals between destinationIndex and source.index, increase the index
        ...columnDeals.filter(
          (deal) => deal.index >= destinationIndex && deal.index < source.index
        ).map(
          (deal) => dataProvider.update("deals", {
            id: deal.id,
            data: { index: deal.index + 1 },
            previousData: deal
          })
        ),
        // for the deal that was moved, update its index
        dataProvider.update("deals", {
          id: source.id,
          data: { index: destinationIndex },
          previousData: source
        })
      ]);
    } else {
      await Promise.all([
        // for all deals between source.index and destinationIndex, decrease the index
        ...columnDeals.filter(
          (deal) => deal.index <= destinationIndex && deal.index > source.index
        ).map(
          (deal) => dataProvider.update("deals", {
            id: deal.id,
            data: { index: deal.index - 1 },
            previousData: deal
          })
        ),
        // for the deal that was moved, update its index
        dataProvider.update("deals", {
          id: source.id,
          data: { index: destinationIndex },
          previousData: source
        })
      ]);
    }
  } else {
    const [{ data: sourceDeals }, { data: destinationDeals }] = await Promise.all([
      dataProvider.getList("deals", {
        sort: { field: "index", order: "ASC" },
        pagination: { page: 1, perPage: 100 },
        filter: { stage: source.stage }
      }),
      dataProvider.getList("deals", {
        sort: { field: "index", order: "ASC" },
        pagination: { page: 1, perPage: 100 },
        filter: { stage: destination.stage }
      })
    ]);
    const destinationIndex = destination.index ?? destinationDeals.length + 1;
    await Promise.all([
      // decrease index on the deals after the source index in the source columns
      ...sourceDeals.filter((deal) => deal.index > source.index).map(
        (deal) => dataProvider.update("deals", {
          id: deal.id,
          data: { index: deal.index - 1 },
          previousData: deal
        })
      ),
      // increase index on the deals after the destination index in the destination columns
      ...destinationDeals.filter((deal) => deal.index >= destinationIndex).map(
        (deal) => dataProvider.update("deals", {
          id: deal.id,
          data: { index: deal.index + 1 },
          previousData: deal
        })
      ),
      // change the dragged deal to take the destination index and column
      dataProvider.update("deals", {
        id: source.id,
        data: {
          index: destinationIndex,
          stage: destination.stage
        },
        previousData: source
      })
    ]);
  }
}, "updateDealStage");
const ContactList = /* @__PURE__ */ __name(() => {
  const { data, error, isPending } = useListContext();
  const translate = useTranslate();
  if (isPending || error) return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "h-8" });
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex flex-row flex-wrap gap-4 mt-4", children: data.map((contact) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-row gap-4 items-center", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(Avatar, { record: contact }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs(
        Link,
        {
          to: `/contacts/${contact.id}/show`,
          className: "text-sm hover:underline",
          children: [
            contact.first_name,
            " ",
            contact.last_name
          ]
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-muted-foreground", children: contact.title && contact.company_name ? translate("resources.contacts.position_at_company", {
        title: contact.title,
        company: contact.company_name
      }) : contact.title || contact.company_name })
    ] })
  ] }, contact.id)) });
}, "ContactList");
const DealShow = /* @__PURE__ */ __name(({ open, id }) => {
  const redirect = useRedirect();
  const handleClose = /* @__PURE__ */ __name(() => {
    redirect("list", "deals");
  }, "handleClose");
  return /* @__PURE__ */ jsxRuntimeExports.jsx(Dialog, { open, onOpenChange: /* @__PURE__ */ __name((open2) => !open2 && handleClose(), "onOpenChange"), children: /* @__PURE__ */ jsxRuntimeExports.jsx(DialogContent, { className: "lg:max-w-4xl p-4 overflow-y-auto max-h-9/10 top-1/20 translate-y-0", children: id ? /* @__PURE__ */ jsxRuntimeExports.jsx(ShowBase, { id, children: /* @__PURE__ */ jsxRuntimeExports.jsx(DealShowContent, {}) }) : null }) });
}, "DealShow");
const DealShowContent = /* @__PURE__ */ __name(() => {
  const translate = useTranslate();
  const { dealStages, dealCategories, currency } = useConfigurationContext();
  const record = useRecordContext();
  if (!record) return null;
  return /* @__PURE__ */ jsxRuntimeExports.jsx(jsxRuntimeExports.Fragment, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-2", children: [
    record.archived_at ? /* @__PURE__ */ jsxRuntimeExports.jsx(ArchivedTitle, {}) : null,
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex-1", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex justify-between items-start mb-8", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-4", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            ReferenceField,
            {
              source: "company_id",
              reference: "companies",
              link: "show",
              children: /* @__PURE__ */ jsxRuntimeExports.jsx(CompanyAvatar, {})
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "text-2xl font-semibold", children: record.name })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: `flex gap-2 ${record.archived_at ? "" : "pr-12"}`, children: record.archived_at ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(UnarchiveButton, { record }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(DeleteButton, {})
        ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(ArchiveButton, { record }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(EditButton, {})
        ] }) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex gap-8 m-4", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col mr-10", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-muted-foreground tracking-wide", children: translate("resources.deals.fields.expected_closing_date") }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm", children: isValid(new Date(record.expected_closing_date)) ? formatISODateString(record.expected_closing_date) : translate("resources.deals.invalid_date") }),
            new Date(record.expected_closing_date) < /* @__PURE__ */ new Date() ? /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { variant: "destructive", children: translate("crm.common.past") }) : null
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col mr-10", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-muted-foreground tracking-wide", children: translate("resources.deals.fields.amount") }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm", children: record.amount.toLocaleString("en-US", {
            notation: "compact",
            style: "currency",
            currency,
            currencyDisplay: "narrowSymbol",
            minimumSignificantDigits: 3
          }) })
        ] }),
        record.category && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col mr-10", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-muted-foreground tracking-wide", children: translate("resources.deals.fields.category") }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm", children: dealCategories.find((c) => c.value === record.category)?.label ?? record.category })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col mr-10", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-muted-foreground tracking-wide", children: translate("resources.deals.fields.stage") }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm", children: findDealLabel(dealStages, record.stage) })
        ] })
      ] }),
      !!record.contact_ids?.length && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "m-4", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col min-h-12 mr-10", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-muted-foreground tracking-wide", children: translate("resources.deals.fields.contact_ids") }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          ReferenceArrayField,
          {
            source: "contact_ids",
            reference: "contacts_summary",
            children: /* @__PURE__ */ jsxRuntimeExports.jsx(ContactList, {})
          }
        )
      ] }) }),
      record.description && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "m-4 whitespace-pre-line", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-muted-foreground tracking-wide", children: translate("resources.deals.fields.description") }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm leading-6", children: record.description })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "m-4", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Separator, { className: "mb-4" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          InfiniteListBase,
          {
            resource: "deal_notes",
            filter: { deal_id: record.id },
            sort: { field: "date", order: "DESC" },
            perPage: 25,
            disableSyncWithLocation: true,
            storeKey: false,
            empty: /* @__PURE__ */ jsxRuntimeExports.jsx(NoteCreate, { reference: "deals" }),
            children: /* @__PURE__ */ jsxRuntimeExports.jsx(NotesIterator, { reference: "deals" })
          }
        )
      ] })
    ] })
  ] }) });
}, "DealShowContent");
const ArchivedTitle = /* @__PURE__ */ __name(() => {
  const translate = useTranslate();
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "bg-orange-500 px-6 py-4", children: /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "text-lg font-bold text-white", children: translate("resources.deals.archived.title") }) });
}, "ArchivedTitle");
const ArchiveButton = /* @__PURE__ */ __name(({ record }) => {
  const translate = useTranslate();
  const [update2] = useUpdate();
  const redirect = useRedirect();
  const notify = useNotify();
  const refresh = useRefresh();
  const handleClick = /* @__PURE__ */ __name(() => {
    update2(
      "deals",
      {
        id: record.id,
        data: { archived_at: (/* @__PURE__ */ new Date()).toISOString() },
        previousData: record
      },
      {
        onSuccess: /* @__PURE__ */ __name(() => {
          redirect("list", "deals");
          notify("resources.deals.archived.success", {
            type: "info",
            undoable: false
          });
          refresh();
        }, "onSuccess"),
        onError: /* @__PURE__ */ __name(() => {
          notify("resources.deals.archived.error", {
            type: "error"
          });
        }, "onError")
      }
    );
  }, "handleClick");
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    Button,
    {
      onClick: handleClick,
      size: "sm",
      variant: "outline",
      className: "flex items-center gap-2 h-9",
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Archive, { className: "w-4 h-4" }),
        translate("resources.deals.archived.action")
      ]
    }
  );
}, "ArchiveButton");
const UnarchiveButton = /* @__PURE__ */ __name(({ record }) => {
  const translate = useTranslate();
  const dataProvider = useDataProvider();
  const redirect = useRedirect();
  const notify = useNotify();
  const refresh = useRefresh();
  const { mutate } = useMutation({
    mutationFn: /* @__PURE__ */ __name(() => dataProvider.unarchiveDeal(record), "mutationFn"),
    onSuccess: /* @__PURE__ */ __name(() => {
      redirect("list", "deals");
      notify("resources.deals.unarchived.success", {
        type: "info",
        undoable: false
      });
      refresh();
    }, "onSuccess"),
    onError: /* @__PURE__ */ __name(() => {
      notify("resources.deals.unarchived.error", {
        type: "error"
      });
    }, "onError")
  });
  const handleClick = /* @__PURE__ */ __name(() => {
    mutate();
  }, "handleClick");
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    Button,
    {
      onClick: handleClick,
      size: "sm",
      variant: "outline",
      className: "flex items-center gap-2 h-9",
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(ArchiveRestore, { className: "w-4 h-4" }),
        translate("resources.deals.unarchived.action")
      ]
    }
  );
}, "UnarchiveButton");
const OnlyMineInput = /* @__PURE__ */ __name((_) => {
  const translate = useTranslate();
  const { filterValues, displayedFilters, setFilters } = useListFilterContext();
  const { identity } = useGetIdentity();
  const handleChange = /* @__PURE__ */ __name(() => {
    const newFilterValues = { ...filterValues };
    if (typeof filterValues.sales_id !== "undefined") {
      delete newFilterValues.sales_id;
    } else {
      newFilterValues.sales_id = identity && identity?.id;
    }
    setFilters(newFilterValues, displayedFilters);
  }, "handleChange");
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-auto pb-2.25", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center space-x-2", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      Switch,
      {
        id: "only-mine",
        checked: typeof filterValues.sales_id !== "undefined",
        onCheckedChange: handleChange
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "only-mine", children: translate("resources.companies.filters.only_mine", {
      _: "Only companies I manage"
    }) })
  ] }) });
}, "OnlyMineInput");
const DealList = /* @__PURE__ */ __name(() => {
  const { identity } = useGetIdentity();
  const { dealCategories } = useConfigurationContext();
  const translate = useTranslate();
  if (!identity) return null;
  const dealFilters = [
    /* @__PURE__ */ jsxRuntimeExports.jsx(SearchInput, { source: "q", alwaysOn: true }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(ReferenceInput, { source: "company_id", reference: "companies", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
      AutocompleteInput,
      {
        label: false,
        placeholder: translate("resources.deals.fields.company_id")
      }
    ) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(WrapperField, { source: "category", label: "resources.deals.fields.category", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
      SelectInput,
      {
        source: "category",
        label: false,
        emptyText: "resources.deals.fields.category",
        choices: dealCategories,
        optionText: "label",
        optionValue: "value"
      }
    ) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(OnlyMineInput, { source: "sales_id", alwaysOn: true })
  ];
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    List,
    {
      perPage: 100,
      filter: { "archived_at@is": null },
      title: false,
      sort: { field: "index", order: "DESC" },
      filters: dealFilters,
      actions: /* @__PURE__ */ jsxRuntimeExports.jsx(DealActions, {}),
      pagination: null,
      children: /* @__PURE__ */ jsxRuntimeExports.jsx(DealLayout, {})
    }
  );
}, "DealList");
const DealLayout = /* @__PURE__ */ __name(() => {
  const location = useLocation();
  const matchCreate = matchPath("/deals/create", location.pathname);
  const matchShow = matchPath("/deals/:id/show", location.pathname);
  const matchEdit = matchPath("/deals/:id", location.pathname);
  const { data, isPending, filterValues } = useListContext();
  const hasFilters = filterValues && Object.keys(filterValues).length > 0;
  if (isPending) return null;
  if (!data?.length && !hasFilters)
    return /* @__PURE__ */ jsxRuntimeExports.jsx(jsxRuntimeExports.Fragment, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs(DealEmpty, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(DealShow, { open: !!matchShow, id: matchShow?.params.id }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(DealArchivedList, {})
    ] }) });
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "w-full", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(DealListContent, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(DealArchivedList, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(DealCreate, { open: !!matchCreate }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(DealEdit, { open: !!matchEdit && !matchCreate, id: matchEdit?.params.id }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(DealShow, { open: !!matchShow, id: matchShow?.params.id })
  ] });
}, "DealLayout");
const DealActions = /* @__PURE__ */ __name(() => /* @__PURE__ */ jsxRuntimeExports.jsxs(TopToolbar, { children: [
  /* @__PURE__ */ jsxRuntimeExports.jsx(FilterButton, {}),
  /* @__PURE__ */ jsxRuntimeExports.jsx(ExportButton, {}),
  /* @__PURE__ */ jsxRuntimeExports.jsx(CreateButton, { label: "resources.deals.action.new" })
] }), "DealActions");
const WrapperField = /* @__PURE__ */ __name(({ children }) => children, "WrapperField");
export {
  DealList as default
};
//# sourceMappingURL=DealList-KHMafF0E.js.map
