<script>
	let { snippet, label = undefined } = $props();
</script>

<zbk-code-block label={label ?? snippet.label ?? snippet.lang} button-variant="ghost sm flat">
	<!-- Shiki renders the project's static source strings at build time. -->
	{@html snippet.html}
</zbk-code-block>
