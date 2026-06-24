import{i as e}from"./preload-helper-CT_b8DTk.js";import{m as t}from"./iframe-Ch1jcsl5.js";import{I as n,P as r,i,t as a,v as o}from"./material-CUHBa0ZF.js";var s,c,l=e((()=>{a(),s=t(),c=({isLoading:e,locationError:t,hasDataError:a,hasCaptureError:c})=>(0,s.jsxs)(s.Fragment,{children:[e&&(0,s.jsxs)(i,{alignItems:`center`,direction:`row`,spacing:1,children:[(0,s.jsx)(n,{size:20}),(0,s.jsx)(o,{color:`text.secondary`,children:`Finding your location…`})]}),t&&(0,s.jsx)(r,{severity:`warning`,children:t}),a&&(0,s.jsx)(r,{severity:`error`,children:`Unable to load weather data. Please try again.`}),c&&(0,s.jsx)(r,{severity:`error`,children:`Unable to save the measurement. Please try again.`})]}),c.__docgenInfo={description:``,methods:[],displayName:`LocationStatus`,props:{isLoading:{required:!0,tsType:{name:`boolean`},description:``},locationError:{required:!0,tsType:{name:`union`,raw:`string | null`,elements:[{name:`string`},{name:`null`}]},description:``},hasDataError:{required:!0,tsType:{name:`boolean`},description:``},hasCaptureError:{required:!0,tsType:{name:`boolean`},description:``}}}})),u,d,f,p,m;e((()=>{l(),u={component:c,title:`Routes/LocationStatus`},d={args:{hasCaptureError:!1,hasDataError:!1,isLoading:!0,locationError:null}},f={args:{hasCaptureError:!1,hasDataError:!1,isLoading:!1,locationError:`Allow location access to load your local forecast.`}},p={args:{hasCaptureError:!1,hasDataError:!0,isLoading:!1,locationError:null}},d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    hasCaptureError: false,
    hasDataError: false,
    isLoading: true,
    locationError: null
  }
}`,...d.parameters?.docs?.source}}},f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  args: {
    hasCaptureError: false,
    hasDataError: false,
    isLoading: false,
    locationError: 'Allow location access to load your local forecast.'
  }
}`,...f.parameters?.docs?.source}}},p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    hasCaptureError: false,
    hasDataError: true,
    isLoading: false,
    locationError: null
  }
}`,...p.parameters?.docs?.source}}},m=[`FindingLocation`,`LocationUnavailable`,`ApiError`]}))();export{p as ApiError,d as FindingLocation,f as LocationUnavailable,m as __namedExportsOrder,u as default};