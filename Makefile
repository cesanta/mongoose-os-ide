# https://code.visualstudio.com/api/working-with-extensions/publishing-extension
# npm i -g vsce

publish:
	vsce package
	vsce publish
