import{i as e}from"./preload-helper-CT_b8DTk.js";import{m as t}from"./iframe-Ch1jcsl5.js";import{A as n,E as r,M as i,O as a,g as o,t as s,v as c,w as l}from"./material-CUHBa0ZF.js";var u,d,f=e((()=>{s(),u=t(),d=({coordinates:e,sticky:t,isSubmitting:s,onStickyChange:d,onSubmit:f})=>(0,u.jsx)(a,{sx:{flex:1},children:(0,u.jsxs)(r,{children:[(0,u.jsx)(c,{component:`h2`,variant:`h6`,gutterBottom:!0,children:`Record your conditions`}),(0,u.jsx)(o,{control:(0,u.jsx)(l,{checked:t,onChange:e=>d(e.target.checked)}),label:`I have a sticky sack`}),(0,u.jsx)(i,{sx:{mt:2},children:(0,u.jsx)(n,{disabled:!e||s,loading:s,onClick:f,variant:`contained`,children:`Submit measurement`})})]})}),d.__docgenInfo={description:``,methods:[],displayName:`MeasurementCard`,props:{coordinates:{required:!0,tsType:{name:`union`,raw:`Coordinates | null`,elements:[{name:`Coordinates`},{name:`null`}]},description:``},sticky:{required:!0,tsType:{name:`boolean`},description:``},isSubmitting:{required:!0,tsType:{name:`boolean`},description:``},onStickyChange:{required:!0,tsType:{name:`signature`,type:`function`,raw:`(sticky: boolean) => void`,signature:{arguments:[{type:{name:`boolean`},name:`sticky`}],return:{name:`void`}}},description:``},onSubmit:{required:!0,tsType:{name:`signature`,type:`function`,raw:`() => void`,signature:{arguments:[],return:{name:`void`}}},description:``}}}})),p,m,h,g;e((()=>{f(),p={component:d,title:`Routes/MeasurementCard`},m={args:{coordinates:{lat:52.370216,lon:4.895168},isSubmitting:!1,onStickyChange:()=>void 0,onSubmit:()=>void 0,sticky:!1}},h={args:{...m.args,isSubmitting:!0}},m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    coordinates: {
      lat: 52.370216,
      lon: 4.895168
    },
    isSubmitting: false,
    onStickyChange: () => undefined,
    onSubmit: () => undefined,
    sticky: false
  }
}`,...m.parameters?.docs?.source}}},h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    ...Default.args,
    isSubmitting: true
  }
}`,...h.parameters?.docs?.source}}},g=[`Default`,`Submitting`]}))();export{m as Default,h as Submitting,g as __namedExportsOrder,p as default};