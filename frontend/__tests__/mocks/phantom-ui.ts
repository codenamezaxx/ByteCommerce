// Mock for @aejkatappaja/phantom-ui web component
if (typeof customElements !== 'undefined' && !customElements.get('phantom-ui')) {
  customElements.define('phantom-ui', class extends HTMLElement {})
}
export default {}
export type PhantomUiAttributes = Record<string, unknown>
