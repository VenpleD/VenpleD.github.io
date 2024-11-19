/*!
 *
 * ZSSRichTextEditor v1.0
 * http://www.zedsaid.com
 *
 * Copyright 2013 Zed Said Studio
 *
 * 感谢ZSSRichTextEditor的基础框架，在此基础上完成了：跨平台整合、功能精简/优化、bugs修复、个性化API实现
 * --2015.12.28
*/
// 安卓和iOS平台采用不同的回调机制
var ua = navigator.userAgent;
var isUsingAndroid = /Android/i.test(ua);
var editorFeature = editorFeature || {};
var androidVersion = 0;

// THe default callback parameter separator
var defaultCallbackSeparator = '~';

var NodeName = {
    BLOCKQUOTE: "BLOCKQUOTE",
    PARAGRAPH: "P"
};

// The editor object
var ZSSEditor = {};

// These variables exist to reduce garbage (as in memory garbage) generation when typing real fast
// in the editor.
ZSSEditor.caretArguments = ['yOffset=' + 0, 'height=' + 0];
ZSSEditor.caretInfo = { y: 0, height: 0 };

// The current selection
ZSSEditor.currentSelection;

ZSSEditor.focusedField = null;

ZSSEditor.editableFields = {};

// The default paragraph separator
ZSSEditor.defaultParagraphSeparator = 'p';

//编辑器区ID
ZSSEditor.editorZoneId = 'editor-mirror';
ZSSEditor.placeholderCls = 'syl-placeholder';
ZSSEditor.nodeId = 'nodeId'


// selecion change 用的频控
/**
 * The initializer function that must be called onLoad
 */
ZSSEditor.init = function() {
    //编辑区
    ZSSEditor.$editor = $('#'+ZSSEditor.editorZoneId);

    //跨平台样式调整
    if(isUsingAndroid){
        ZSSEditor.$editor.addClass('android');

        var ver = /Android\s(\d.\d)/i.exec(ua);
        if(ver){
            androidVersion = parseFloat(ver[1]);
        }
    }

    rangy.init();

    document.execCommand('insertBrOnReturn', false, false);
    document.execCommand('defaultParagraphSeparator', false, this.defaultParagraphSeparator);
    document.execCommand('styleWithCSS', false, true);

    var editor = $('div#'+ZSSEditor.editorZoneId).each(function() {
        var editableField = new ZSSField( $(this) );
        var editableFieldId = editableField.getNodeId();
        ZSSEditor.editableFields[editableFieldId] = editableField;
        ZSSEditor.callback("newField", "id=" + editableFieldId);
    });
    $('textarea.p-post-article-title-input').each(function() {
        let input = $(this)
        input.bind('input', function(e) { ZSSEditor.handleTitleInputEvent(e); });
        // var editableField = new ZSSField( $(this) );
        // var editableFieldId = editableField.getNodeId();
        // ZSSEditor.editableFields["textarea.p-post-article-title-input"] = editableField;
        // ZSSEditor.callback("callback-new-field", "id=" + "textarea.p-post-article-title-input");
    })

    //iOS需要用到selectionChangedCallback进行键盘相关UI调整
    var selectionchangeInterval;
    var selectionchangeIntervalTime = 0;
	document.addEventListener("selectionchange", function(e) {
		// DRM: only do something here if the editor has focus.  The reason is that when the
		// selection changes due to the editor loosing focus, the focusout event will not be
		// sent if we try to load a callback here.


        var t = new Date().getTime();
        clearTimeout(selectionchangeInterval);
        // selectionchangeInterval = setTimeout(function(){
        //     if (editor.is(":focus")) {
        //         ZSSEditor.selectionChangedCallback();
        //         ZSSEditor.sendEnabledStyles(e);
        //     }
        // },300);
	}, false);

    //只允许粘贴纯文本，避免从别处复制粘贴进来大量html标签
    $('[contenteditable]').on('paste',function(e) {
        var plainText = '';
        try {
            var oriE = e.originalEvent || e;
            plainText = oriE.clipboardData.getData('text/plain') || oriE.clipboardData.getData('text');
            // plainText = (e.originalEvent || e).clipboardData.getData('text/plain');
            if (!plainText) {
                return;
            }
            var div = $('<div></div>');
            div.html(plainText);
            ZSSEditor.insertHTML(div.text());
            e.preventDefault();
        }catch(ex){}

        // try{
        //     var html = (e.originalEvent || e).clipboardData.getData('text/html');
        //     console.log(html);
        //     var div = document.createElement("p");
        //     div.innerHTML = html;
        //     var p = filterNode(div,ZSSEditor.filterRules);
        //     console.log(p);
        // }catch(e){
        //
        // }
        // if(p){
        //     e.preventDefault();
        //     ZSSEditor.insertHTML(p.innerHTML);
        // }
        //低版本安卓系统（如4.4.4）比较挫，不支持上述获取剪贴板内容的API，对这类支持不好的系统，只能放行原始粘贴内容。
        //好在提交时，getHTML接口会过滤html标签



        // if(plainText){
        //     e.preventDefault();
        //     ZSSEditor.insertText(plainText);
        // }
    });

    this.domLoadedCallback();
};

ZSSEditor.handleTitleInputEvent = function(e) {
    var tempE = e;
    $('pre.autofit-textarea-content').each(function() {
        if (tempE.currentTarget.className == "p-post-article-title-input") {
            var obj = $(this)
            console.log("------"+ tempE.currentTarget.value+tempE.currentTarget);
            obj.context.innerHTML = tempE.currentTarget.value;
        }

    })
}

ZSSEditor.emptyObj = function(e) {
    if (typeof e == "undefined" || e == null) {
        return true
      } else {
        return false
      }
}

ZSSEditor.emptyString = function(e) {
    if (!ZSSEditor.emptyObj(e) && (typeof e === 'string') && e.length > 0) {
        return false
      }
    return true
}

// MARK: - Callbacks

ZSSEditor.callback = function(callbackScheme, callbackPath) {

    var url =  callbackScheme + ":";

    // if (callbackPath) {
    //     url = url + callbackPath;
    // }
    var params = callbackPath;
    if (!ZSSEditor.emptyString(callbackPath) && callbackPath.indexOf('=')!== -1) {
        var pairs = callbackPath.split(defaultCallbackSeparator);
        var jsonObj = {};
        for (var i = 0; i < pairs.length; i++) {
            var pair = pairs[i];
            var keyValue = pair.split('=');
            jsonObj[keyValue[0]] = keyValue[1];
        }
        try {
            var result = JSON.parse(JSON.stringify(jsonObj));
            params = result;
        } catch (e) {
            console.log('旧参数无法转换json对象');
        }
    } else {
        console.log('旧参数，并且没有等号'+callbackPath + '\n' + ZSSEditor.callback.caller.toString());
    }
    try {
        bridge.call(callbackScheme, params);
    } catch (ex) {}
    // if (isUsingAndroid) {
    //     try{
    //         nativeCallbackHandler.executeCallback(callbackScheme, callbackPath);
    //     }catch(ex){}
    // } else {
    //     ZSSEditor.callbackThroughIFrame(url);
    // }
};

/**
 *  @brief      Executes a callback by loading it into an IFrame.
 *  @details    The reason why we're using this instead of window.location is that window.location
 *              can sometimes fail silently when called multiple times in rapid succession.
 *              Found here:
 *              http://stackoverflow.com/questions/10010342/clicking-on-a-link-inside-a-webview-that-will-trigger-a-native-ios-screen-with/10080969#10080969
 *
 *  @param      url     The callback URL.
 */
ZSSEditor.callbackThroughIFrame = function(url) {
    var iframe = document.createElement("IFRAME");
    iframe.setAttribute("src", url);

    // IMPORTANT: the IFrame was showing up as a black box below our text.  By setting its borders
    // to be 0px transparent we make sure it's not shown at all.
    //
    // REF BUG: https://github.com/wordpress-mobile/WordPress-iOS-Editor/issues/318
    //
    iframe.style.cssText = "border: 0px transparent;";

    document.documentElement.appendChild(iframe);
    iframe.parentNode.removeChild(iframe);
    iframe = null;
};

ZSSEditor.domLoadedCallback = function() {
    this.callback("domLoaded");
};

ZSSEditor.selectionChangedCallback = function () {
    var joinedArguments = this.getJoinedFocusedFieldIdAndCaretArguments();

    this.callback('selectionChanged', joinedArguments);
    this.callback("input", joinedArguments);
};

ZSSEditor.stylesCallback = function(stylesArray) {



    var stylesString = '';

    if (stylesArray.length > 0) {
        stylesString = stylesArray.join(defaultCallbackSeparator);
    }

    ZSSEditor.callback("selectionStyle", stylesString);
};

// MARK: - Logging

ZSSEditor.log = function(msg) {
    ZSSEditor.callback('log', 'msg=' + msg);
};

// MARK: - Viewport Refreshing

//动态刷新编辑器高度，iOS设备依赖此接口动态调整编辑器大小，而android系统级自适应
ZSSEditor.refreshVisibleViewportSize = function() {
    var winHeight = window.innerHeight,
        editorTop = ZSSEditor.$editor.position().top,
        editorHeight = winHeight - editorTop;

    $(document.body).css('min-height', winHeight + 'px');
    ZSSEditor.$editor.css('min-height', editorHeight + 'px');
};

// MARK: - Fields

ZSSEditor.focusFirstEditableField = function() {
    $('div[contenteditable=true]:first').focus();
};

ZSSEditor.getField = function(fieldId) {
    //如果未提供参数，默认选择正文编辑器对象
    fieldId = fieldId || this.editorZoneId;
    var field = this.editableFields[fieldId];

    return field;
};

ZSSEditor.getFocusedField = function() {
    return this.getField();
};

// MARK: - Selection

//以下两个函数会被iOS客户端调用
ZSSEditor.backupRange = function () {
	var selection = window.getSelection();

    if(selection.rangeCount){
        var range = selection.getRangeAt(0);

        var startOffset = range.startOffset,endOffset = range.endOffset,i,textContent,len;
        /**
         * fix ios 简体拼音输入法
         * **/
        if(range.startContainer.textContent === range.endContainer.textContent){
            textContent = range.startContainer.textContent;
            for(i = 0 ,len = startOffset ; i < len; i ++){
                if(/[\u2006]/.test(textContent.charAt(i))){
                    startOffset -- ;
                    endOffset -- ;
                }
            }

            if(endOffset > startOffset){
                for(i = startOffset ,len = endOffset ; i < len; i ++){
                    if(/[\u2006]/.test(textContent.charAt(i))){
                        endOffset -- ;
                    }
                }
            }
        }

        ZSSEditor.currentSelection = {
            "startContainer": range.startContainer,
            "startOffset": startOffset,
            "endContainer": range.endContainer,
            "endOffset": endOffset
        };
    }
};

ZSSEditor.restoreRange = function(){
    if (this.currentSelection) {
        var selection = window.getSelection();
        
        var range = document.createRange();
        try {
            if (!this.currentSelection.startContainer.parentNode || !this.currentSelection.endContainer.parentNode) {
                return;
            }
            range.setStart(this.currentSelection.startContainer, this.currentSelection.startOffset);
            range.setEnd(this.currentSelection.endContainer, this.currentSelection.endOffset);
        } catch (e) {
            range.setStart(this.currentSelection.startContainer, this.currentSelection.startContainer.textContent.length);
            range.setEnd(this.currentSelection.endContainer, this.currentSelection.endContainer.textContent.length);
        }
        selection.removeAllRanges();
        selection.addRange(range);
        this.currentSelection = undefined;
    }
};

ZSSEditor.getSelectedText = function() {
	var selection = window.getSelection();

	return selection.toString();
};

// 获取当前光标信息
ZSSEditor.getCaretArguments = function() {
    var caretInfo = this.getYCaretInfo();

    if (caretInfo == null) {
        return null;
    } else {
        this.caretArguments[0] = 'yOffset=' + caretInfo.y;
        this.caretArguments[1] = 'height=' + caretInfo.height;
        this.caretArguments[2] = 'xOffset=' + caretInfo.x;
        return this.caretArguments;
    }
};

ZSSEditor.getJoinedFocusedFieldIdAndCaretArguments = function() {
    var joinedArguments = ZSSEditor.getJoinedCaretArguments();
    var idArgument = "id=" + ZSSEditor.getFocusedField().getNodeId();

    joinedArguments = idArgument + defaultCallbackSeparator + joinedArguments;

    return joinedArguments;
};

ZSSEditor.getJoinedCaretArguments = function() {
    var caretArguments = this.getCaretArguments();
    var joinedArguments = this.caretArguments.join(defaultCallbackSeparator);

    return joinedArguments;
};

ZSSEditor.getCaretYPosition = function() {
    var selection = window.getSelection();
    var range = selection.getRangeAt(0);
    var span = document.createElement("span");
    // Ensure span has dimensions and position by
    // adding a zero-width space character
    span.appendChild( document.createTextNode("\u200b") );
    range.insertNode(span);
    var y = span.offsetTop;
    var spanParent = span.parentNode;
    spanParent.removeChild(span);

    // Glue any broken text nodes back together
    spanParent.normalize();

    return y;
}

ZSSEditor.getYCaretInfo = function() {
    var selection = window.getSelection();
    var noSelectionAvailable = selection.rangeCount == 0;

    if (noSelectionAvailable) {
        return null;
    }

    var y = 0, x;
    var height = 0;
    var range = selection.getRangeAt(0);
    var needsToWorkAroundNewlineBug = (range.getClientRects().length == 0);

    // PROBLEM: iOS seems to have problems getting the offset for some empty nodes and return
    // 0 (zero) as the selection range top offset.
    //
    // WORKAROUND: To fix this problem we use a different method to obtain the Y position instead.
    //
    if (needsToWorkAroundNewlineBug) {
        var closerParentNode = ZSSEditor.closerParentNode();

        var fontSize = $(closerParentNode).css('font-size');
        var lineHeight = Math.floor(parseInt(fontSize.replace('px','')) * 1.5);

        y = this.getCaretYPosition();
        height = lineHeight;
    } else {
        if (range.getClientRects) {
            var rects = range.getClientRects();
            if (rects.length > 0) {
                // PROBLEM: some iOS versions differ in what is returned by getClientRects()
                // Some versions return the offset from the page's top, some other return the
                // offset from the visible viewport's top.
                //
                // WORKAROUND: see if the offset of the body's top is ever negative.  If it is
                // then it means that the offset we have is relative to the body's top, and we
                // should add the scroll offset.
                //
                var addsScrollOffset = document.body.getClientRects()[0].top < 0;

                if (addsScrollOffset) {
                    y = document.body.scrollTop;
                }

                y += rects[0].top;
                height = rects[0].height;
                x = rects[0].left;
            }
        }
    }

    this.caretInfo.y = y;
    this.caretInfo.x = x;
    this.caretInfo.height = height;

    return this.caretInfo;
};

// MARK: - Default paragraph separator

ZSSEditor.defaultParagraphSeparatorTag = function() {
    return '<' + this.defaultParagraphSeparator + '>';
};


ZSSEditor.setBold = function() {
	document.execCommand('bold', false, null);
	ZSSEditor.sendEnabledStyles();
};

ZSSEditor.setItalic = function() {
	document.execCommand('italic', false, null);
	ZSSEditor.sendEnabledStyles();
};

ZSSEditor.setUnderline = function() {
	document.execCommand('underline', false, null);
	ZSSEditor.sendEnabledStyles();
};

ZSSEditor.setOrderedList = function() {
    document.execCommand('insertOrderedList', false, null);
    ZSSEditor.sendEnabledStyles();
    fixListElement();
};


// 插入列表默尔恩会形成p>ul形式。把ul放到顶级
function fixListElement(){
    ZSSEditor.$editor.find('ol,ul').each(function(i,n){
        var parent = n.parentNode;
        if(parent.tagName == 'P' && parent.lastChild === parent.firstChild){
            $(n).children().each(function(j,li){
                var p = parent.cloneNode(false);
                $(p).append(li.innerHTML);
                $(li).html('').append(p.innerHTML);
            });
            $(n).insertBefore(parent);
            $(parent).remove();

            var li = $(n).find('li');
            if (li.length) {
                li = li[li.length - 1];

                var newRange = document.createRange();
                newRange.setStartAfter(li);

                var selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(newRange);
            }
        }
    });
}

ZSSEditor.setUnorderedList = function() {
	document.execCommand('insertUnorderedList', false, null);
	ZSSEditor.sendEnabledStyles();
    fixListElement();
};

ZSSEditor.setBlockQuote = function(){
    var p = getTopParent();
    if(!p){
        return;
    }
    var nodeName = p.nodeName.toLowerCase();
    var np;
    if(nodeName==="blockquote"){
            np = document.createElement("p");
            np.innerHTML = p.innerHTML;
            p.parentNode.replaceChild(np,p);
            focusElement(np);
            // p.innerHTML = p.innerText;
            // document.execCommand("formatBlock",false,"p");
    }else if(nodeName==="ul"||nodeName==="ol"){
        if(document.queryCommandValue("formatBlock")==="blockquote"){
                document.execCommand("formatBlock",false,"p");
        }else{
            document.execCommand("formatBlock",false,"blockquote");
        }
    }else{
        // document.execCommand("formatBlock",false,"blockquote");
        np = document.createElement("blockquote");
        np.innerHTML = p.innerHTML;
        p.parentNode.replaceChild(np,p);
        focusElement(np);
    }

    // if(document.queryCommandValue("formatBlock")==="blockquote"){
    //         document.execCommand("formatBlock",false,"p");
    // }else{
    //     document.execCommand("formatBlock",false,"blockquote");
    // }
    ZSSEditor.sendEnabledStyles();
};

ZSSEditor.setH1 = function(){
    var p = getTopParent();
    if(!p){
        return;
    }
    var nodeName = p.nodeName.toLowerCase();
    var np;
    var range = document.createRange();
    if(nodeName==="h1"){
            np = document.createElement("p");
            np.innerHTML = p.innerHTML;
            p.parentNode.replaceChild(np,p);
            focusElement(np);
    }else if(nodeName==="ul"||nodeName==="ol"){
        if(document.queryCommandValue("formatBlock")==="h1"){
            document.execCommand("formatBlock",false,"p");
        }else{
            document.execCommand("formatBlock",false,"h1");
            // 在列表中选择设置标题，去掉列表状态
        }
    }else{
        // document.execCommand("formatBlock",false,"blockquote");
        np = document.createElement("h1");
        np.innerHTML = p.innerHTML;
        p.parentNode.replaceChild(np,p);
        focusElement(np);
    }

    ZSSEditor.sendEnabledStyles();
};

function focusElement(ele){
    var self = window.getSelection();
    var range = document.createRange();
    // var sp = document.createTextNode(" ");
    // parentNode.appendChild(sp);
    // range.selectNodeContents(ele.parentNode.lastChild);
    range.setStart(ele,1);
    // range.setStartAfter(ele);

    self.removeAllRanges();
    self.addRange(range);
}

function getTopParent(){
    var p = ZSSEditor.closerParentNode();
    if(!p){
        return null;
    }
    var count = 0;
    while(true){
        if(!p.parentNode){
            return null;
        }
        if(p.parentNode.id===ZSSEditor.editorZoneId||count===6){
            break;
        }
        p = p.parentNode;
        count++;

    }
    return p;
}

// MARK: - Styles
/*
//以下富文本编辑命令暂时用不到，先注释掉，后续如果需要扩展编辑功能时打开


ZSSEditor.setSubscript = function() {
	document.execCommand('subscript', false, null);
	ZSSEditor.sendEnabledStyles();
};

ZSSEditor.setSuperscript = function() {
	document.execCommand('superscript', false, null);
	ZSSEditor.sendEnabledStyles();
};

ZSSEditor.setStrikeThrough = function() {
	var commandName = 'strikeThrough';
	var isDisablingStrikeThrough = ZSSEditor.isCommandEnabled(commandName);

	document.execCommand(commandName, false, null);

	// DRM: WebKit has a problem disabling strikeThrough when the tag <del> is used instead of
	// <strike>.  The code below serves as a way to fix this issue.
	//
	var mustHandleWebKitIssue = (isDisablingStrikeThrough
								 && ZSSEditor.isCommandEnabled(commandName));

	if (mustHandleWebKitIssue) {
		var troublesomeNodeNames = ['del'];

		var selection = window.getSelection();
		var range = selection.getRangeAt(0).cloneRange();

		var container = range.commonAncestorContainer;
		var nodeFound = false;
		var textNode = null;

		while (container && !nodeFound) {
			nodeFound = (container
						 && container.nodeType == document.ELEMENT_NODE
						 && troublesomeNodeNames.indexOf(container.nodeName.toLowerCase()) > -1);

			if (!nodeFound) {
				container = container.parentElement;
			}
		}

		if (container) {
			var newObject = $(container).replaceWith(container.innerHTML);

			var finalSelection = window.getSelection();
			var finalRange = selection.getRangeAt(0).cloneRange();

			finalRange.setEnd(finalRange.startContainer, finalRange.startOffset + 1);

			selection.removeAllRanges();
			selection.addRange(finalRange);
		}
	}

	ZSSEditor.sendEnabledStyles();
};



ZSSEditor.removeFormating = function() {
	document.execCommand('removeFormat', false, null);
	ZSSEditor.sendEnabledStyles();
};

ZSSEditor.setHorizontalRule = function() {
	document.execCommand('insertHorizontalRule', false, null);
	ZSSEditor.sendEnabledStyles();
};

ZSSEditor.setHeading = function(heading) {
	var formatTag = heading;
	var formatBlock = document.queryCommandValue('formatBlock');

	if (formatBlock.length > 0 && formatBlock.toLowerCase() == formatTag) {
		document.execCommand('formatBlock', false, this.defaultParagraphSeparatorTag());
	} else {
		document.execCommand('formatBlock', false, '<' + formatTag + '>');
	}

	ZSSEditor.sendEnabledStyles();
};

ZSSEditor.setParagraph = function() {
	var formatTag = "p";
	var formatBlock = document.queryCommandValue('formatBlock');

	if (formatBlock.length > 0 && formatBlock.toLowerCase() == formatTag) {
		document.execCommand('formatBlock', false, this.defaultParagraphSeparatorTag());
	} else {
		document.execCommand('formatBlock', false, '<' + formatTag + '>');
	}

	ZSSEditor.sendEnabledStyles();
};

ZSSEditor.undo = function() {
	document.execCommand('undo', false, null);
	ZSSEditor.sendEnabledStyles();
};

ZSSEditor.redo = function() {
	document.execCommand('redo', false, null);
	ZSSEditor.sendEnabledStyles();
};

ZSSEditor.setOrderedList = function() {
    document.execCommand('insertOrderedList', false, null);
    ZSSEditor.sendEnabledStyles();
};

ZSSEditor.setUnorderedList = function() {
	document.execCommand('insertUnorderedList', false, null);
	ZSSEditor.sendEnabledStyles();
};

ZSSEditor.setJustifyCenter = function() {
	document.execCommand('justifyCenter', false, null);
	ZSSEditor.sendEnabledStyles();
};

ZSSEditor.setJustifyFull = function() {
	document.execCommand('justifyFull', false, null);
	ZSSEditor.sendEnabledStyles();
};

ZSSEditor.setJustifyLeft = function() {
	document.execCommand('justifyLeft', false, null);
	ZSSEditor.sendEnabledStyles();
};

ZSSEditor.setJustifyRight = function() {
	document.execCommand('justifyRight', false, null);
	ZSSEditor.sendEnabledStyles();
};

ZSSEditor.setIndent = function() {
	document.execCommand('indent', false, null);
	ZSSEditor.sendEnabledStyles();
};

ZSSEditor.setOutdent = function() {
	document.execCommand('outdent', false, null);
	ZSSEditor.sendEnabledStyles();
};

ZSSEditor.setTextColor = function(color) {
    ZSSEditor.restoreRange();
	document.execCommand("styleWithCSS", null, true);
	document.execCommand('foreColor', false, color);
	document.execCommand("styleWithCSS", null, false);
	ZSSEditor.sendEnabledStyles();
    // document.execCommand("removeFormat", false, "foreColor"); // Removes just foreColor
};

ZSSEditor.setBackgroundColor = function(color) {
	ZSSEditor.restoreRange();
	document.execCommand("styleWithCSS", null, true);
	document.execCommand('hiliteColor', false, color);
	document.execCommand("styleWithCSS", null, false);
	ZSSEditor.sendEnabledStyles();
};
*/

// by wangcongwu
ZSSEditor.insertLink = function(url,text){
    ZSSEditor.insertHTML('<a  href="'+url+'">'+text+'</a>');
};

// by wangcongwu
ZSSEditor.insertHr = function(){
    ZSSEditor.insertHTML('<hr/>');
    ZSSEditor.insertHTML('<p><br/></p>');
};

// MARK: - Images

ZSSEditor.insertImage = function(url, alt,noWait) {
    //新的图片插入解决方案，前后<br>换行
    var self = window.getSelection();
    if(self.rangeCount < 1) return;

    //
    var that = this,
        currentField = this.getFocusedField();
    currentField.wrapCaretInParagraphIfNecessary();

    var fragment = document.createDocumentFragment('div'),
        before_br = document.createElement('br'),
        after_br = document.createElement('br'),
        img = document.createElement('img'),
        zeroWidthWord = document.createTextNode('\u200b'),
        range = self.getRangeAt(0).cloneRange(),
        startNode = range.startContainer;
    if ($(startNode).closest('a').length) {
        range = document.createRange();
        range.setStartAfter($(startNode).closest('a')[0]);
    }
    var onload = function(){
        //只在文本节点中间插入图片时，前面才需要插入<br>换新行
        if(startNode.nodeType == 3 && range.startOffset != 0){
            fragment.appendChild(before_br);
        }
        fragment.appendChild(img);
        fragment.appendChild(after_br);
        fragment.appendChild(zeroWidthWord);

        range.insertNode(fragment);
        range.selectNodeContents(zeroWidthWord);
        range.collapse(true);

        self.removeAllRanges();
        self.addRange(range);

        //安卓平台不能自动滚动到光标位置，需前端主动scroll页面
        if(isUsingAndroid){
            var top = img.offsetTop,
                height = img.offsetHeight,
                scroll = top + height;

            setTimeout(function(){
                //此处必须设置超时，否则，不能按预期scrollTo
                window.scrollTo(0, scroll);
            },300);
        }

        that.sendEnabledStyles();

        var joinedArguments = ZSSEditor.getJoinedFocusedFieldIdAndCaretArguments();
    
        this.callback('sselectionChanged', joinedArguments);
        that.callback("input", joinedArguments);
        ZSSEditor.selectionChangedCallback();
    }
    if (noWait) {
        onload();
    } else {
        img.onload = onload;
    }
    img.src = url;

    return;
    //以下为老版本策略，暂时废弃，观察上面新策略效果

    //iOS暂时不支持平板，在手机上默认让插入的图片宽度100%于父容器，这样就不用考虑图片前后文字换行问题，类似知乎现有机制
    //android支持平板，需要在用户插入图片前后自动断行，避免图片和文字处于同一行上面
    /*if(isUsingAndroid && androidVersion < 4.4){
        var html = '&#x200b;<br><img id="cur_img" src="'+url+'" alt="'+alt+'" /><br><br>&#x200b;';
        this.insertHTML(html);

        var self = window.getSelection();
        var range = document.createRange();
        var img = document.getElementById('cur_img');
        range.setStartAfter(img);
        range.setEndBefore(img.nextSibling.nextSibling);
        self.removeAllRanges();
        self.addRange(range);
        img.removeAttribute('id');
    }else{
        isUsingAndroid && ZSSEditor.setNewLineBeforeInsertImageIfNecessary();
        var html = '<img src="'+url+'" alt="'+alt+'" />';
        this.insertHTML(html);
        isUsingAndroid && ZSSEditor.setNewLineAfterImageNodeIfNecessary();
    }

    this.sendEnabledStyles();
    */
};


ZSSEditor.insertVideo = function(url,vid,poster_local,poster_online) {
    //新的图片插入解决方案，前后<br>换行
    var self = window.getSelection();
    if(self.rangeCount < 1) return;

    //
    var that = this,
    currentField = this.getFocusedField();
    currentField.wrapCaretInParagraphIfNecessary();

    var fragment = document.createDocumentFragment('div'),
    before_br = document.createElement('br'),
    after_br = document.createElement('br'),
    video = document.createElement('video');
    var zeroWidthWord = document.createTextNode('\u200b');
    var deleteBtn = document.createElement('i');
    var range = self.getRangeAt(0).cloneRange();
    var startNode = range.startContainer;
    setTimeout(function(){
      

        if(startNode.nodeType == 3 && range.startOffset != 0){
            fragment.appendChild(before_br);
        }
        before_text = document.createElement('p');
        before_text.innerHTML = "video:";
        before_text.className = 'video_placeholder';   //占位符
        before_text.style.display = "none";
        deleteBtn.className = 'delete-icon';
        deleteBtn.setAttribute("data-node",'delete-video'); 
        deleteBtn.setAttribute("contenteditable",false);
        video.setAttribute("contenteditable",false); 
        video.setAttribute("poster",poster_local); 
        video.setAttribute("data-poster",poster_online); 
        video.setAttribute("data-vid",vid);   
        video.setAttribute("controls",true);
        fragment.appendChild(before_text);
        // fragment.appendChild(deleteBtn);
        fragment.appendChild(video);
        // fragment.appendChild(after_br);
        // fragment.appendChild(zeroWidthWord);
        video.src = url;

        // alert(123);
        var afterDom = range.endContainer;
        if ($(afterDom).closest('a').length) {
            afterDom = $(afterDom).closest('a');
            if ($.contains(currentField.wrappedObject[0],afterDom[0])) {
                $(fragment).insertAfter(afterDom);
            } else {
                $(fragment).appendTo(currentField.wrappedObject);
            }
        } else {
            range.insertNode(fragment);
        }

        var $p = $('<p>\u200b</p>');
        $p.insertAfter($(video.parentNode));
        
        
        range.selectNodeContents($p[0]);
        range.collapse(true);

        // alert(1234);

        self.removeAllRanges();
        self.addRange(range);
	
	
	    var joinedArguments = ZSSEditor.getJoinedFocusedFieldIdAndCaretArguments();
	    that.callback("input", joinedArguments);

        //安卓平台不能自动滚动到光标位置，需前端主动scroll页面
        if(isUsingAndroid){
            var top = video.offsetTop,
                height = video.offsetHeight,
                scroll = top + height;

            setTimeout(function(){
                //此处必须设置超时，否则，不能按预期scrollTo
                window.scrollTo(0, scroll);
            },300);
        }
        that.sendEnabledStyles();
        ZSSEditor.selectionChangedCallback();
    },50);

    return;
};
// if(!/android/.test(navigator.userAgent.toLowerCase())){
//     ZSSEditor.insertVideo = function(url,vid,poster_local,poster_online){
//         var html = '&#x200b;<br><video controls="true" data-vid="'+vid+'" src="'+url+'" poster="'+poster_local+'"  data-poster="'+poster_online+'"/><br>&#x200b;';
//         this.insertHTML(html);
//     }
// }



/*
* 如果当前光标位置为文本节点，插入图片时强制另起一行<br>
*/
ZSSEditor.setNewLineBeforeInsertImageIfNecessary = function(){
    var self = window.getSelection();
    if(self.rangeCount){
        var range = self.getRangeAt(0);
        if(range.commonAncestorContainer.nodeType == 3){
            var br1 = document.createElement('br'),
                br2 = br1.cloneNode(),
                range2 = document.createRange();

            range.insertNode(br1);
            range.insertNode(br2);
            range2.selectNode(br1);

            self.removeAllRanges();
            self.addRange(range2);
        }
    }
};

/*
* 插入图片后，让光标起点另起一行
*/
ZSSEditor.setNewLineAfterImageNodeIfNecessary = function(){
    var self = window.getSelection();
    if(self.rangeCount){
        var range = self.getRangeAt(0),
            endCon = range.endContainer,
            endPos = range.endOffset;
        if(endCon.nodeType == 1 && endPos > 0){
            var curNode = endCon.childNodes[endPos-1];
            if(curNode.nodeName.toLowerCase() == 'img'){
                var br = document.createElement('br'),
                    range2 = document.createRange();

                range.insertNode(br);
                range2.setStartAfter(br);

                self.removeAllRanges();
                self.addRange(range2);
            }
        }
    }
};

ZSSEditor.insertHTML = function(html) {
    var currentField = this.getFocusedField();

    // When inserting HTML in the editor (like media), we must make sure the caret is wrapped in a
    // paragraph tag.  By forcing to have all content inside paragraphs we obtain a behavior that's
    // much closer to the one we have in our web editor.
    //
    currentField.wrapCaretInParagraphIfNecessary();

	document.execCommand('insertHTML', false, html);
	this.sendEnabledStyles();
};

ZSSEditor.insertText = function(plainText) {
    var currentField = this.getFocusedField();

    //原因同ZSSEditor.insertHTML
    currentField.wrapCaretInParagraphIfNecessary();

    document.execCommand('insertText', false, plainText);
    this.sendEnabledStyles();
};

ZSSEditor.isCommandEnabled = function(commandName) {
	return document.queryCommandState(commandName);
};

ZSSEditor.sendEnabledStyles = function(e) {
    console.log(ZSSEditor.sendEnabledStyles.caller.toString());
	var items = [];

    var focusedField = this.getFocusedField();

    if (!focusedField.hasNoStyle) {
        if (ZSSEditor.isCommandEnabled('bold')) {
            items.push('bold');
        }
        if (ZSSEditor.isCommandEnabled('createLink')) {
            items.push('createLink');
        }
        if (ZSSEditor.isCommandEnabled('italic')) {
            items.push('italic');
        }
        if (ZSSEditor.isCommandEnabled('subscript')) {
            items.push('subscript');
        }
        if (ZSSEditor.isCommandEnabled('superscript')) {
            items.push('superscript');
        }
        if (ZSSEditor.isCommandEnabled('strikeThrough')) {
            items.push('strikeThrough');
        }
        if (ZSSEditor.isCommandEnabled('underline')) {
            items.push('underline');
        }
        if (ZSSEditor.isCommandEnabled('insertOrderedList')) {
            items.push('orderedList');
        }
        if (ZSSEditor.isCommandEnabled('insertUnorderedList')) {
            items.push('unorderedList');
        }
        if (ZSSEditor.isCommandEnabled('justifyCenter')) {
            items.push('justifyCenter');
        }
        if (ZSSEditor.isCommandEnabled('justifyFull')) {
            items.push('justifyFull');
        }
        if (ZSSEditor.isCommandEnabled('justifyLeft')) {
            items.push('justifyLeft');
        }
        if (ZSSEditor.isCommandEnabled('justifyRight')) {
            items.push('justifyRight');
        }
        if (ZSSEditor.isCommandEnabled('insertHorizontalRule')) {
            items.push('horizontalRule');
        }
        var formatBlock = document.queryCommandValue('formatBlock');
        if (formatBlock.length > 0) {
            items.push(formatBlock);
        }
    }

	ZSSEditor.stylesCallback(items);
};

ZSSField.prototype.getEnabledStyles = function(){
    var obj = {
           'bold':0,
           'orderedList':0,
           'underline':0,
           'unorderedList':0,
           'h1':0,
           'blockquote':0
       };
       var focusedField = ZSSEditor.getFocusedField();
       if (!focusedField.hasNoStyle) {
           if (ZSSEditor.isCommandEnabled('bold')) {
               obj['bold']=1;
           }
           if (ZSSEditor.isCommandEnabled('underline')) {
               obj['underline']=1;
           }


           if (ZSSEditor.isCommandEnabled('insertOrderedList')) {
               obj['orderedList']=1;
           }
           if (ZSSEditor.isCommandEnabled('insertUnorderedList')) {
               obj['unorderedList']=1;
           }


           // var formatBlock = document.queryCommandValue('formatBlock');
           // if (formatBlock.length > 0) {
           //     if(obj[formatBlock]==0){
           //         obj[formatBlock]=1;
           //     }
           // }
           var p =  getTopParent();
           if(p){
               if(p.nodeName.toLowerCase() === "blockquote"){
                   obj['blockquote'] = 1;
               }else{
                   if(document.queryCommandValue('formatBlock')=="blockquote"){
                       obj['blockquote'] = 1;
                   }
               }
               if(p.nodeName.toLowerCase() === "h1"){
                   obj['h1'] = 1;
               }else{
                   if(document.queryCommandValue('formatBlock')=="h1"){
                       obj['h1'] = 1;
                   }
               }
           }
       }
       return JSON.stringify(obj);
};

ZSSField.prototype.getEnabledStylesForCallback = function() {
    var functionArgument = "function=getEnabledStylesForCallback";
    var idArgument = "id=" + this.getNodeId();
    var contentsArgument = "contents=" + this.getEnabledStyles();
    var joinedArguments = functionArgument + defaultCallbackSeparator + idArgument + defaultCallbackSeparator +
        contentsArgument;
        // console.log(joinedArguments);
    ZSSEditor.callback('responseString', joinedArguments);
};

// ZSSEditor.getEnabledStyles = function(){
//     var obj = {
//         'bold':0,
//         'orderedList':0,
//         'underline':0,
//         'unorderedList':0,
//         'h1':0,
//         'blockquote':0
//     };
//     var focusedField = this.getFocusedField();
//     if (!focusedField.hasNoStyle) {
//         if (ZSSEditor.isCommandEnabled('bold')) {
//             obj['bold']=1;
//         }
//         if (ZSSEditor.isCommandEnabled('underline')) {
//             obj['underline']=1;
//         }
//
//
//         if (ZSSEditor.isCommandEnabled('insertOrderedList')) {
//             obj['orderList']=1;
//         }
//         if (ZSSEditor.isCommandEnabled('insertUnorderedList')) {
//             obj['unordedList']=1;
//         }
//
//
//         // var formatBlock = document.queryCommandValue('formatBlock');
//         // if (formatBlock.length > 0) {
//         //     if(obj[formatBlock]==0){
//         //         obj[formatBlock]=1;
//         //     }
//         // }
//         var p =  getTopParent();
//         if(p){
//             if(p.nodeName.toLowerCase() === "blockquote"){
//                 obj['blockquote'] = 1;
//             }else{
//                 if(document.queryCommandValue('formatBlock')=="blockquote"){
//                     obj['blockquote'] = 1;
//                 }
//             }
//             if(p.nodeName.toLowerCase() === "h1"){
//                 obj['h1'] = 1;
//             }else{
//                 if(document.queryCommandValue('formatBlock')=="h1"){
//                     obj['h1'] = 1;
//                 }
//             }
//         }
//     }
//     return obj;
//
// };

// MARK: - Parent nodes & tags

ZSSEditor.closerParentNode = function() {

    var parentNode = null;
    var selection = window.getSelection();
    if(selection.rangeCount){
        var range = selection.getRangeAt(0).cloneRange();

        var currentNode = range.commonAncestorContainer;

        while (currentNode) {
            if (currentNode.nodeType == document.ELEMENT_NODE) {
                parentNode = currentNode;
                break;
            }

            currentNode = currentNode.parentElement;
        }
    }

    return parentNode;
};

// MARK: - ZSSField Constructor

function ZSSField(wrappedObject) {

    this.wrappedObject = wrappedObject;

    // When this bool is true, we are going to restrict input and certain callbacks
    // so IME keyboards behave properly when composing.
    this.isComposing = false;

    this.multiline = true;

    //是否准备从空白编辑器开始输入内容的flag开关
    this.prepareToWriteContentFromEmptyEditor = true;

    this.bindListeners();
};

ZSSField.prototype.bindListeners = function() {

    var thisObj = this;

    this.wrappedObject.bind('tap', function(e) { thisObj.handleTapEvent(e); });
    this.wrappedObject.bind('focus', function(e) { thisObj.handleFocusEvent(e); });
    this.wrappedObject.bind('blur', function(e) { thisObj.handleBlurEvent(e); });
    this.wrappedObject.bind('keydown', function(e) { thisObj.handleKeyDownEvent(e); });
    this.wrappedObject.bind('keyup', function(e) { thisObj.handleKeyUpEvent(e); });
    this.wrappedObject.bind('input', function(e) { thisObj.handleInputEvent(e); });
    this.wrappedObject.bind('compositionstart', function(e) { thisObj.handleCompositionStartEvent(e); });
    this.wrappedObject.bind('compositionend', function (e) { thisObj.handleCompositionEndEvent(e); });
    // this.wrappedObject.bind('touchstart', function (e) { thisObj.touchStart(e); });
    // this.wrappedObject.bind('touchend', function (e) { thisObj.touchEnd(e); });
    // $('body').on('tap', 'a.out-link', this.clickOutLink.bind(this));
    $('body').bind('tap', function (e) { thisObj.handleClick(e); });
    //this.bindMutationObserver();
};

/*ZSSField.prototype.bindMutationObserver = function () {
    var target = this.wrappedObject[0];
    // create an observer instance
    var observer = new MutationObserver(function(mutations) {
                        mutations.forEach(function(mutation) {
                            for (var i = 0; i < mutation.removedNodes.length; i++) {
                                var removedNode = mutation.removedNodes[i];

                                //if ( ZSSEditor.isMediaContainerNode(removedNode) ) {
                                //    var mediaIdentifier = ZSSEditor.extractMediaIdentifier(removedNode);
                                //    ZSSEditor.sendMediaRemovedCallback(mediaIdentifier);
                                //}
                            }
                        });
                    });

    // configuration of the observer:
    var config = { attributes: false, childList: true, characterData: false };

    // pass in the target node, as well as the observer options
    observer.observe(target, config);
};*/

// MARK: - Emptying the field when it should be, well... empty (HTML madness)

/**
 *  @brief      Sometimes HTML leaves some <br> tags or &nbsp; when the user deletes all
 *              text from a contentEditable field.  This code makes sure no such 'garbage' survives.
 *  @details    If the node contains child image nodes, then the content is left untouched.
 */
ZSSField.prototype.emptyFieldIfNoContents = function() {

    var text = this.wrappedObject.text().replace(/[\s\u00a0\u200b]/g,''),
        isEditorEmpty = false;

    if (text.length == 0) {
        var hasChildImages = (this.wrappedObject.find('img').length > 0 || this.wrappedObject.find('video').length > 0);

        if (!hasChildImages) {
            this.wrappedObject.empty();

            isEditorEmpty = true;
        }
    }
    return isEditorEmpty;
};

// MARK: - Handle event listeners

ZSSField.prototype.handleBlurEvent = function(e) {
    ZSSEditor.focusedField = null;

    var isEditorEmpty = this.emptyFieldIfNoContents();
    if (isEditorEmpty) {
        this.addDefaultEmptyHtml();
    }
    this.callback("focusOut");
};

ZSSField.prototype.addDefaultEmptyHtml = function(e) {
    if (this.isComposing) {
        return;
    }
    this.wrappedObject.context.innerHTML = "";
    this.wrappedObject.context.innerHTML = "<p><br></p>";
    console.log("--空"+ZSSField.prototype.addDefaultEmptyHtml.caller.toString());
    
}

ZSSField.prototype.handleFocusEvent = function(e) {
    ZSSEditor.focusedField = this;
    let node = ZSSEditor.closerParentNode();
    this.wrappedObject.addClass("ProseMirror-focused")
    // IMPORTANT: this is the only case where checking the current focus will not work.
    // We sidestep this issue by indicating that the field is about to gain focus.
    //
    //this.refreshPlaceholderColorAboutToGainFocus(true);
    this.callback("focusIn");
};




var removeVideoInterval;

ZSSField.prototype.handleKeyDownEvent = function(e) {
    
    var wasEnterPressed = (e.keyCode == 13),
        wasBackspacePressed = (e.keyCode == 8),
        wasSpacePressed = e.keyCode == 32;
	var that = this;
    console.log("debug-keydownEvent-"+wasBackspacePressed+","+wasEnterPressed+","+wasSpacePressed);
    if (this.isComposing) {
        e.stopPropagation();
    } else if (wasEnterPressed && !this.isMultiline()) {
        e.preventDefault();
    } else if (this.isMultiline() && !wasBackspacePressed && !wasEnterPressed) {
        //用户按回车键、退格删除键的时候不进行wrapCaretInParagraphIfNecessary动作
        //适用场景：
        //1，iOS设备在空白编辑器状态按实体键输入文本，对第一行文字包裹<p>标签
        //不适用于：
        //1，低版本Android系统（如4.4.4），keydown事件发生时，操作dom range会覆盖掉已经输入的文本，故不能在此处理
        //2，iOS设备在不按字母键盘，而直接点击软键盘推荐文字时候，不触发keydown事件
        //以上情形在handleInputEvent事件中处理
        if(!isUsingAndroid){
            this.wrapCaretInParagraphIfNecessary();
        }
    }
    if(wasBackspacePressed){
        clearTimeout(removeVideoInterval);
        var self = window.getSelection();
        var range = self.getRangeAt(0);
        if (this.isOutLink(range.endContainer) ||
            (range.startContainer.previousSibling && this.isOutLink(range.startContainer.previousSibling) && this.isEmptyRange(range) && (range.startOffset == 0 || (range.startOffset == 1 && range.startContainer.data == '\u200b')))) {
            var v = range.startContainer.previousSibling;
            v.parentNode.removeChild(v);

            return;
        }
        var joinedArguments = ZSSEditor.getJoinedFocusedFieldIdAndCaretArguments();
        function setRangeTo (obj) {
            if (!obj) {
                return;
            }
            var selecion = window.getSelection();
            var newRange = document.createRange();
            newRange.setStartAfter(obj);
            newRange.setEndAfter(obj);
            selecion.removeAllRanges();
            selecion.addRange(newRange);
            
            // ZSSEditor.backupRange();
        }
        if (this.isLinkAt(range.startContainer) && range.startOffset != 0) {
            setRangeTo(range.startContainer.previousSibling);
            $(range.startContainer).remove();
            this.callback("input", joinedArguments);
            e.preventDefault();
            this.emptyFieldIfNoContents();
            return;
        } else if(this.isLinkAt(range.startContainer.parentNode) && range.startOffset != 0){
            setRangeTo(range.startContainer.parentNode.previousSibling);
            $(range.startContainer.parentNode).remove();
            this.callback("input", joinedArguments);
            e.preventDefault();
            this.emptyFieldIfNoContents();
            return;
        }
        if (this.isLinkAt(range.startContainer.previousSibling) && range.startOffset == 0) {
            setRangeTo(range.startContainer.previousSibling.previousSibling);
            $(range.startContainer.previousSibling).remove();
            this.callback("input", joinedArguments);
            e.preventDefault();
            this.emptyFieldIfNoContents();
            return;
        }
        if (range.startContainer.tagName == 'P') {
            var lastChild = range.startContainer.lastChild;
            if (this.isLinkAt(lastChild)) {
                $(lastChild).remove();
                this.callback("input", joinedArguments);
                e.preventDefault();
                this.emptyFieldIfNoContents();
                return;
            }
        }

        // 尝试删除视频
        removeVideoInterval = setTimeout(function(){
            var self = window.getSelection();
            var range = self.getRangeAt(0);
            if(isUsingAndroid){
                if(range.startContainer.previousSibling && range.startContainer.previousSibling.tagName=='VIDEO'){
                    console.log('deleteVideo')
                    var v = range.startContainer.previousSibling;
                    var vid = v.getAttribute('data-vid') || '';
	                try{
		                var hideVideo = v.previousSibling ;
		                if(hideVideo.className.indexOf('video_placeholder') !== -1){
			                v.parentNode.removeChild(hideVideo);
		                }
	                }catch(e){}
	
	                v.parentNode.removeChild(v);
	                
                    that.callback("deleteVideo", [joinedArguments,'fake_vid=' + vid].join(defaultCallbackSeparator));
                    that.callback("input", joinedArguments);
                }
            }
           

            if(!isUsingAndroid){
                var s = range.startContainer;
                if(s && s.tagName == 'P' && s.previousSibling.tagName == 'P'){
                    var v = s.previousSibling;
                    if($(v).find('video').length>0){
                        $(v).find('.video_placeholder').remove();
                        var text = $(v).text();
                        $(v).html('').text(text);
                    }
               }else if(s.previousSibling && s.previousSibling.tagName == 'VIDEO'){
                    var v = s.previousSibling.parentNode;
                    $(v).find('.video_placeholder').remove();
                    var text = $(v).text();
                    $(v).html('').text(text);
            }
               // ios删不掉视频的case
               // if(s.parentNode.tagName == 'SPAN' && s.parentNode.previousSibling.tagName == 'BR'){
               //      var v = s.parentNode.previousSibling;
               //      v.parentNode.removeChild(v);
               // }else if(s.parentNode.tagName == 'SPAN' && s.parentNode.previousSibling.tagName == 'VIDEO'){
               //      var v = s.parentNode.previousSibling;
               //      v.parentNode.removeChild(v);
               // }
            }

        },100);

        ZSSEditor.backupRange();
    }
    else if (wasEnterPressed) {
        this.checkWhetherChangeToLink(true);
        this.lastParaWrapper = getTopParent()||ZSSEditor.closerParentNode();
        // console.log(this.lastParaWrapper.innerText,this.lastParaWrapper.nodeName,this.lastParaWrapper.innerText.replace(/\s/ig,"")==="");
        if(this.lastParaWrapper.nodeName=="BLOCKQUOTE"&&this.lastParaWrapper.innerText.replace(/\s/ig,"")===""){
            document.execCommand("formatBlock",false,'p');
            e.preventDefault();
        }

        // 回车之后下划线和加粗不继承
        var s = ZSSEditor.getField("zss_field_content").getEnabledStyles();
        s = JSON.parse(s);
        if(s.bold){
            ZSSEditor.setBold();
        }
        if(s.underline){
            ZSSEditor.setUnderline();
        }
        
        if (!this.isComposing && this.cancelAt()) {
            // e.preventDefault();
        }
    }else{
    // if (wasSpacePressed) {
        this.checkWhetherChangeToLink();
        if (!this.isComposing && this.cancelAt()) {
            e.preventDefault();
        }
    }

    $('.link-edit-tip').remove();
    $('.editing').removeClass('editing');
};

ZSSField.prototype.handleKeyUpEvent = function(e) {
    // var wasEnterPressed = (e.keyCode == 13);
    // if(wasEnterPressed&&this.lastParaWrapper.nodeName=="BLOCKQUOTE"){
    //     document.execCommand("formatBlock",false,'p');
    // }
    var wasEnterPressed = (e.keyCode == 13),
    wasBackspacePressed = (e.keyCode == 8),
        wasSpacePressed = e.keyCode == 32;
        var isEditorEmpty = this.emptyFieldIfNoContents();
console.log("debug-keyupEvent-"+wasBackspacePressed+","+wasEnterPressed+","+wasSpacePressed+','+isEditorEmpty);
    if (wasBackspacePressed && isEditorEmpty) {
        // this.addDefaultEmptyHtml();
    }
    if (wasEnterPressed || wasBackspacePressed) {
        
    } else {
        // this.checkWhetherChangeToLink();
        // this.checkWhetherPopAt();
    }
};

ZSSField.prototype.isOutLink = function (el) {
    return el.className && el.className.indexOf('out-link') > -1;
}
ZSSField.prototype.isLinkAt = function (el) {
    if (!el) {
        return false;
    }
    if (el.className && el.className.indexOf('link-at') > - 1) {
        return el;
    }
}
ZSSField.prototype.isEmptyRange = function (range) { 
    return range.startContainer == range.endContainer && range.startOffset == range.endOffset;
}


ZSSField.prototype.linkCheck = function(){
    var parentNode = ZSSEditor.closerParentNode();
    var simpleUrlExp = /((http|https)\:\/\/)?[\w\.]*\.(com|edu|gov|mil|net|org|info|us)(\/[^\s]*)?/ig;

    var self = window.getSelection();

    if(parentNode.tagName!=="A"){
        var node = parentNode.lastChild;
        if(node.nodeType==3){
            console.log(node);
            var html = node.nodeValue;
            if(simpleUrlExp.test(html)){
                html = html.replace(simpleUrlExp,function($0){
                    var url = $0;
                    if(!/http/.test(url)){
                        url = "http://"+url;
                    }
                    return '<a href="'+url+'" target="_blank">'+$0+'</a>';
                });
                var s = document.createElement("div");
                s.innerHTML = html;

                while(s.childNodes.length>0){
                    var s_node = s.childNodes[0];
                    parentNode.insertBefore(s_node,node);
                }
                parentNode.removeChild(node);


                var range = document.createRange();
                var sp = document.createTextNode(" ");
                parentNode.appendChild(sp);
                range.selectNodeContents(parentNode.lastChild);
                range.setStart(sp,1);

                window.sss= range;
                self.removeAllRanges();
                self.addRange(range);
                // range.setStartAfter(parentNode.lastChild);
                return true;
            }
        }

    }
    return false;

}

ZSSField.prototype.handleInputEvent = function(e) {
    // Skip this if we are composing on an IME keyboard
    var isEditorEmpty = this.emptyFieldIfNoContents();
    let placeholder = $(".syl-placeholder")[0]
    if(isEditorEmpty){
        placeholder.style.zIndex = 99;
        placeholder.innerText = "请输入正文";        
        this.addDefaultEmptyHtml();
    }else if(this.prepareToWriteContentFromEmptyEditor){
        placeholder.style.zIndex = -1;
        placeholder.innerText = "";
        $('#'+ZSSEditor.editorZoneId).find('p:empty').remove();
        
    }
    console.log("debug-inputEvent-"+e.originalEvent.data);
    if (ZSSEditor.emptyObj(e.originalEvent.data)) {
        console.log("debug-inputEvent-"+e.key);
    }
    if (this.isComposing ) { return; }

    // IMPORTANT: we want the placeholder to come up if there's no text, so we clear the field if
    // there's no real content in it.  It's important to do this here and not on keyDown or keyUp
    // as the field could become empty because of a cut or paste operation as well as a key press.
    // This event takes care of all cases.
    //
    //处理wrapCaretInParagraphIfNecessary动作无法在keydown事件中正确处理的情形
    //通过prepareToWriteContentFromEmptyEditor开关，避免后续每次input事件都重复计算
    if(isEditorEmpty){
        this.prepareToWriteContentFromEmptyEditor = true;
    }else if(this.prepareToWriteContentFromEmptyEditor){
        this.wrapCaretInParagraphIfNecessary();
        this.prepareToWriteContentFromEmptyEditor = false;
        
    }

    this.checkWhetherChangeToLink();

    this.checkWhetherPopAt();

    var joinedArguments = ZSSEditor.getJoinedFocusedFieldIdAndCaretArguments
        ();
    
    this.cancelAt();

    this.callback('selectionChanged', joinedArguments);
    this.callback("input", joinedArguments);
};

ZSSField.prototype.handleCompositionStartEvent = function(e) {
    this.isComposing = true;
    console.log("--composingStart" + this.isComposing);
};

ZSSField.prototype.handleCompositionEndEvent = function(e) {
    this.isComposing = false;
    console.log("--composingEnd" + this.isComposing);
    setTimeout(function(){
        this.checkWhetherChangeToLink();    
    }.bind(this), 10);
    
    var joinedArguments = ZSSEditor.getJoinedFocusedFieldIdAndCaretArguments();

    this.handleKeyDownEvent(e);
    
    this.callback('selectionChanged', joinedArguments);
    this.callback("input", joinedArguments);
};

ZSSField.prototype.handleTapEvent = function(e) {
    //点击图片时光标自动定位到图片下一行的起点处
    var targetNode = e.target;

    if (targetNode && targetNode.nodeName.toLowerCase() == 'img') {
        var self = window.getSelection(),
            range = document.createRange(),
            next = targetNode.nextSibling,
            zeroStr = '\u200b';

        if(!next || next.nodeName.toLowerCase() !='br'){
            //如果img节点后面没有兄弟节点，或紧接着不是br
            targetNode.insertAdjacentHTML('afterend','<br>\u200b');
            nt = targetNode.nextSibling.nextSibling;
        }else{
            //判断下个节点是否为文本节点，如果是选中，否则插入zero宽字符并选中
            var nt = next.nextSibling;
            if(!(nt && nt.nodeType == 3)){
                next.insertAdjacentHTML('afterend','\u200b');
                nt = next.nextSibling;
            }
        }

        range.selectNodeContents(nt);
        range.collapse(true);
        self.removeAllRanges();
        self.addRange(range);
    }
};

// MARK: - Callback Execution

ZSSField.prototype.callback = function(callbackScheme, callbackPath) {

    var url = callbackScheme + ":";

    url = url + "id=" + this.getNodeId();

    if (callbackPath) {
        url = url + defaultCallbackSeparator + callbackPath;
    }

    if (isUsingAndroid) {
        try{
            nativeCallbackHandler.executeCallback(callbackScheme, callbackPath);
        }catch(ex){}
    } else {
        ZSSEditor.callbackThroughIFrame(url);
    }
};

// MARK: - Focus

ZSSField.prototype.isFocused = function() {
    return this.wrappedObject.is(':focus');
};

ZSSField.prototype.focus = function() {
    if (!this.isFocused()) {
        this.wrappedObject.focus();
    }
};

ZSSField.prototype.blur = function() {
    if (this.isFocused()) {
        this.wrappedObject.blur();
    }
};

// MARK: - Multiline support

ZSSField.prototype.isMultiline = function() {
    return this.multiline;
};

ZSSField.prototype.setMultiline = function(multiline) {
    this.multiline = multiline;
};

// MARK: - NodeId

ZSSField.prototype.getNodeId = function() {
    return this.wrappedObject.attr('id');
};

// MARK: - Editing

ZSSField.prototype.enableEditing = function () {
    this.wrappedObject.attr('contenteditable', true);

    if (!ZSSEditor.focusedField) {
        ZSSEditor.focusFirstEditableField();
    }
};

ZSSField.prototype.disableEditing = function () {
    // IMPORTANT: we're blurring the field before making it non-editable since that ensures
    // that the iOS keyboard is dismissed through an animation, as opposed to being immediately
    // removed from the screen.
    //
    this.blur();

    this.wrappedObject.attr('contenteditable', false);
};

// MARK: - Caret

/**
 *  @brief      Whenever this method is called, a check will be performed on the caret position
 *              to figure out if it needs to be wrapped in a paragraph node.
 *  @details    A parent paragraph node should be added if the current parent is either the field
 *              node itself, or a blockquote node.
 */
ZSSField.prototype.wrapCaretInParagraphIfNecessary = function(){
    if(isUsingAndroid && androidVersion < 4.4 ){
        //android 4.4以下系统在使用此处wrap功能时产生异常
        return;
    }
    var selection = window.getSelection();
    if (!selection.rangeCount) {
        return;
    }
    var range = selection.getRangeAt(0);

    var closerParentNode = ZSSEditor.closerParentNode();
    // winAlert(closerParentNode.outerHTML)
    // var parentNodeShouldBeParagraph = (closerParentNode == this.wrappedDomNode() || closerParentNode.nodeName == NodeName.BLOCKQUOTE);
    // BLOCKQUOTE case : author wangcongwu
    var parentNodeShouldBeParagraph = (closerParentNode == this.wrappedDomNode());
    if (parentNodeShouldBeParagraph && range.endContainer.tagName != 'P') {
        if (selection.rangeCount) {

            if (range.startContainer == range.endContainer) {
                //如果文本节点以wrappedDomNode的子节点形式存在，则对其包裹<p>标签，并维持当前选区范围位置
                if(range.startContainer.nodeType == 3){
                    var p =document.createElement('p'),
                        node = range.startContainer,
                        startOffset = range.startOffset,
                        r2 = document.createRange(),
                        r3 = document.createRange(),
                        txt = null;

                    r2.selectNodeContents(node);
                    r2.surroundContents(p);
                    txt = p.firstChild;
                    r3.setStart(txt,startOffset);
                    r3.setEnd(txt,startOffset);

                    selection.removeAllRanges();
                    selection.addRange(r3);
                    console.log("上上")
                }else{
                    var paragraph = document.createElement("p");
                    var textNode = document.createTextNode("\xa0");

                    paragraph.appendChild(textNode);

                    range.insertNode(paragraph);
                    range.selectNode(textNode);

                    selection.removeAllRanges();
                    selection.addRange(range);
                    console.log("下下")
                }
            }
        }
    }
};

// MARK: - HTML contents

ZSSField.prototype.isEmpty = function() {
    var html = this.getHTML();
    var isEmpty = (html.length == 0 || html == "<br>");

    return isEmpty;
};

//客户端发表时接口
ZSSField.prototype.getHTML = function() {
    //var html = wp.saveText(this.wrappedObject.html());
    var html = this.wrappedObject.html(),
        $tmp = $('<div>'+html+'</div>');

    //remove blank p
    $tmp.find('.video_placeholder').each(function(idx, el){
        var $el = $(el);
        $el.remove();
    });

    $tmp.find('[data-node="delete-video"]').each(function(idx, el){
        var $el = $(el);
        $el.remove();
    });

    $tmp.find('p').each(function(idx, el){
        var $el = $(el);
        if(el.innerHTML == '<br>'){
            $el.remove();
        }
    });

    return $tmp.html();
};

/*
* 安卓需要“异步”获取getXXX方法的返回值，所以针对getXXX接口，需要同步为Android实现getXXXForCallback方法
* 此处的function/id/contents顺序要严格保持，客户端对其顺序敏感。其他getXXXForCallback方法同理。
*/
ZSSField.prototype.getHTMLForCallback = function() {
    var functionArgument = "function=getHTMLForCallback";
    var idArgument = "id=" + this.getNodeId();
    var contentsArgument = "contents=" + this.getHTML();
    var joinedArguments = functionArgument + defaultCallbackSeparator + idArgument + defaultCallbackSeparator +
        contentsArgument;
    ZSSEditor.callback('responseString', joinedArguments);
};

ZSSField.prototype.strippedHTML = function() {
    return this.wrappedObject.text();
};

ZSSField.prototype.setPlainText = function(text) {
    this.wrappedObject.text(text);
};

ZSSField.prototype.processHTML = function (html) { 
    html = html || '';
    html = html.replace(/(<\/a>)(\s*)($|<\/p>|<\/div>)/gi, function ($1, $2, $3,$4) { 
        return $2 + '\xa0' + $4;
    });
    return html;
}

//客户端通过此接口加载本地保存的草稿
ZSSField.prototype.setHTML = function(html, focusToEnd) {
    var mutatedHTML = this.processHTML(html);
    this.wrappedObject.html(mutatedHTML);
    this.focusRangeEnd(focusToEnd);
};

ZSSField.prototype.focusRangeEnd = function(focusToEnd){
    //加载草稿后调整光标输入起始位置
    var editor = this.wrappedObject[0],
        self = window.getSelection(),
        range = document.createRange(),
        zeroWidthWordReg = /^[\s\u00a0\u200b]$/,
        lastNode = editor.lastChild,
        needAddBrAndZeroWord = false;

    if(focusToEnd && lastNode){
        //if(!lastNode) return;

        var userSimpleCaretAdjust = false;

        if(userSimpleCaretAdjust){
            //把光标简单定位到编辑器末尾，不考虑最后有效内容是图片时，光标自动换行
            range.selectNodeContents(editor);
            range.setStartAfter(editor.lastChild);
        }else{
            //精细化光标定位到编辑器末尾，如果最后有效内容是图片，要考虑光标在图片后自动换行

            switch(lastNode.nodeType){
                case 1:
                    adjustLastNode(lastNode);
                    break;
                case 3:
                    var nodeValue = lastNode.nodeValue,
                        preEle = null;

                    while(nodeValue && nodeValue.length == 1 && zeroWidthWordReg.test(nodeValue)){
                        preEle = lastNode.previousSibling;
                        nodeValue = preEle ? preEle.nodeValue : '';
                    }
                    if(preEle && preEle.nodeType == 1){
                        adjustLastNode(preEle);
                    }
                    break;
            }

            if(needAddBrAndZeroWord){
                lastNode.insertAdjacentHTML('afterend','<br>\u200b');
                var nt = lastNode.nextSibling.nextSibling;
                range.selectNodeContents(nt);
                range.collapse(true);
            }else{
                range.selectNodeContents(editor);
                range.setStartAfter(editor.lastChild);
            }
        }
        self.removeAllRanges();
        self.addRange(range);
    }else{
        //输入光标定位到编辑器顶部
        var firstNode = editor.firstChild;
        if(firstNode){
            range.selectNodeContents(firstNode);
            range.collapse(true);
            self.removeAllRanges();
            self.addRange(range);
        }
    }

    function adjustLastNode(ele){
        if(ele.nodeType != 1) return;

        var name = ele.nodeName.toLowerCase();
        if(name == 'img' || name == 'video'){
            needAddBrAndZeroWord = true;
            lastNode = ele;
        }else{
            var _end = ele.lastChild;
            if(_end){
                var _name = _end.nodeName.toLowerCase();
                if(_name == 'img' || _name == 'video'){
                    lastNode = _end;
                    needAddBrAndZeroWord = true;
                }else if(_name == '#text' && zeroWidthWordReg.test(_end.nodeValue)){
                    var _preEle = _end.previousSibling ;
                    if(!_preEle){
                    	return
                    }
                    var _value = _preEle.nodeValue;
                    while(_value && _value.length == 1 && zeroWidthWordReg.test(_value)){
                        _preEle = _preEle.previousSibling;
                        _value = _preEle ? _preEle.nodeValue : '';
                    }

                    if(_preEle && (_preEle.nodeName.toLowerCase() == 'img' || _preEle.nodeName.toLowerCase() == 'video')){
                        lastNode = _preEle;
                        needAddBrAndZeroWord = true;
                    }
                }
            }
        }
    }
};

// MARK: - Placeholder

//供客户端调用
ZSSField.prototype.setPlaceholderText = function(placeholder) {
    this.wrappedObject.attr('placeholderText', placeholder);
};

// MARK: - Wrapped Object

ZSSField.prototype.wrappedDomNode = function() {
    return this.wrappedObject[0];
};

//问答编辑器特殊需求，提供给客户端调用

//设置编辑器整体文本大小
ZSSField.prototype.setBaseFontSize = function(size) {
    this.wrappedObject.css('font-size', size);
};

//设置编辑器整体文本颜色
ZSSField.prototype.setBaseTextColor = function(color) {
    this.wrappedObject.css('color', color);
};

//设置编辑器行高
ZSSField.prototype.setBaseLineHeight = function(val) {
    this.wrappedObject.css('line-height', val);
};

//获取编辑器中当前插入图片个数
ZSSField.prototype.getImageCount = function(){
    return this.wrappedObject.find('img').length;
};

ZSSField.prototype.getVideoCount = function(){
    return this.wrappedObject.find('video').length;
};

ZSSField.prototype.getImageCountForCallback = function() {
    var functionArgument = "function=getImageCountForCallback";
    var idArgument = "id=" + this.getNodeId();
    var contentsArgument = "contents=" + this.getImageCount();
    var joinedArguments = functionArgument + defaultCallbackSeparator + idArgument + defaultCallbackSeparator +
        contentsArgument;
    ZSSEditor.callback('responseString', joinedArguments);
};

//获取编辑器中当期插入图片src集合
ZSSField.prototype.getImages = function(){
    var arr = [];
    this.wrappedObject.find('img').each(function(){
        arr.push(this.src);
    });
    return arr.join('|');
};

/**
 * type : 返回的数据类型，默认为string拼接
 * 1 ： 代表返回object数据 
 * **/
ZSSField.prototype.getVideos = function(type){
    var arr = [];
    this.wrappedObject.find('video').each(function(){
        if(type === 1){
            arr.push({
                src : this.src,
                poster : this.getAttribute('poster'),
                vid : this.getAttribute('data-vid')
            })       
        }else{
            arr.push(this.src);
            arr.push(this.getAttribute('data-vid'));
        }
    });
    
    if(type === 1){
        return JSON.stringify(arr) ;
    }

    return arr.join('|');
};

ZSSEditor.replaceVideoId = ZSSField.prototype.replaceVideoId = function(oldId,newId){
    var $video = $('[data-vid="'+oldId+'"]');
    $video.attr("data-vid",newId);
};

ZSSEditor.updatePoster = function(vid,poster_online){
     var $video = $('[data-vid="'+vid+'"]');
     $video.attr("data-poster",poster_online);
}

ZSSEditor.deleteVideoById = function(vid){
    var $video = $('[data-vid="'+vid+'"]');
    var $pre = $video.prev();
    var $pre_pre = $video.prev().prev();
    if($pre.hasClass("video_placeholder") || $pre.data('node')=='delete-video'){
        $pre.remove();
        // 删掉占位的div
    }
    if($pre_pre.hasClass("video_placeholder") || $pre_pre.data('node')=='delete-video'){
        $pre_pre.remove();
         // 删掉删除按钮
    }
    var $next = $video.next();
    if($next[0]){
        if($next[0].nodeName == "BR" || $next[0].nodeValue == ""){
            $next.remove();
        }
    }
    $video.remove();
	
	var joinedArguments = ZSSEditor.getJoinedFocusedFieldIdAndCaretArguments();
	ZSSEditor.callback('input-change',joinedArguments);
	
}

ZSSField.prototype.getImagesForCallback = function(){
    var functionArgument = "function=getImagesForCallback";
    var idArgument = "id=" + this.getNodeId();
    var contentsArgument = "contents=" + this.getImages();
    var joinedArguments = functionArgument + defaultCallbackSeparator + idArgument + defaultCallbackSeparator +
        contentsArgument;
    ZSSEditor.callback('responseString', joinedArguments);
};

/**
 * type : 返回的数据类型，默认为string拼接
 * 1 ： 代表返回object数据 
 * **/
ZSSField.prototype.getVideosForCallback = function(type){
    var functionArgument = "function=getVideosForCallback";
    var idArgument = "id=" + this.getNodeId();
    var contentsArgument = "contents=" + this.getVideos(type);
    var joinedArguments = functionArgument + defaultCallbackSeparator + idArgument + defaultCallbackSeparator +
        contentsArgument;
    ZSSEditor.callback('responseString', joinedArguments);
};

ZSSField.prototype.checkWhetherChangeToLink = function (isEnter) { 

    var selection = window.getSelection();
    var range = selection.getRangeAt(0);
    var start = range.startContainer;
    var end = range.endContainer;
    /** 空格按的太快的话会连续进逻辑，用span来屏蔽下 */
    if (end.nodeType == 3 && start == end && range.startOffset == range.endOffset && $(end).parents('span[id^=link]').length == 0 &&  $(end).parents('a').length == 0) {
        var data = end.data;
        var endPos = range.endOffset;
        var pre = data.substring(0, endPos);
        var reg = /((http|https)\:\/\/)?@?[\w\.]*\.([a-z]+)(\/[\x00-\xff]*)?(\s|[^\x00-\xff])+$/i
        if (isEnter) {
            var reg = /((http|https)\:\/\/)?@?[\w\.]*\.([a-z]+)(\/[\x00-\xff]*)?$/i
        }
        if (reg.test(pre)) {
            var id = Math.random() + '';
            id = id.replace(/^\d\./, '');
            data = data.substring(endPos);
            var isMail = false;
            pre = pre.replace(reg, function ($0) {
                $0 = $0.replace(/(\s|[^\x00-\xff])+$/g, function ($1, $2) { 
                    data = $1 + data;
                    return '';
                });
                var href = $0;
                if (!/^http/i.test(href)) {
                    if (/^@/.test(href)) {
                        isMail = true;
                    }
                    href = 'http://' + href;
                } else {
                    if (/^(http|https)\:\/\/@/i.test(href)) {
                        isMail = true;
                    }
                }
                return '<span id="link' + id + '" href="' + href + '" class="link-span">' + $0 + '</span>';
            });
            if (isMail) {
                return;
            }

            if (!data.length) {
                data = data + '\xa0';
            }
            end.data = data;
            var range = document.createElement('div');
            range.innerHTML = pre;
            var child = range.childNodes;
            $(child).insertBefore(end);

            this.checkLinkHref(id);

            var range = document.createRange();
            range.setStart(end, data.length);
            range.setEnd(end, data.length);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }    
}

ZSSField.prototype.checkWhetherPopAt = function () { 
    if (this.isComposing) {
        return;
    }
    var selection = window.getSelection();
    var range = selection.getRangeAt(0);
    if (!range) {
        return;
    }
    var start = range.startContainer;
    var end = range.endContainer;
    if (start == end && range.startOffset == range.endOffset && end.data) {
        var word = end.data.substring(range.endOffset, range.endOffset - 1);
        if (word == '@') {
            // 不延迟一下ios会造成光标位置跳到@前面
            setTimeout(function () { 
                ZSSEditor.callback('popAt');
            }, 10);

        }
    }
}

ZSSField.prototype.setAt = function (code, uid, uname, noWhitespace) {
    ZSSEditor.restoreRange();
    if (code == 1 || code == -1) {
        this.wrapCaretInParagraphIfNecessary();
        var selection = window.getSelection();
        var range = selection.getRangeAt(0);
        if (!range) {
            return;
        }
        var endContainer = range.endContainer;
        if (endContainer.parentNode && endContainer.parentNode.tagName == 'A') {
            endContainer = endContainer.parentNode;
        }
        var endData = endContainer.data || '';
        var word = endData.substring(range.endOffset, range.endOffset - 1);
        var partA, partB;
        if (word == '@') {
            partA = endData.substring(0, range.endOffset - 1) || '';
            partB = endData.substr(range.endOffset) || '';
        } else {
            partA = endData.substring(0, range.endOffset);
            partB = endData.substr(range.endOffset);
        }
        partA = partA.replace(/\u200b$/, '');

        var nodeA = document.createTextNode(partA);
        var nodeB;
        if (noWhitespace) {
            nodeB = document.createTextNode(partB);
        } else {
            nodeB = document.createTextNode('\xa0' + partB);
        }
        var a;
        if (code == 1) {
            a = $('<a href="https://www.wukong.com/user/?uid=' + uid + '" target="_blank" class="link-at" data-uid="' + uid + '"></a> ');
            a.text('@' + uname);
        }
        if (code == -1) {
            a = document.createTextNode('@' + uname);
            a = $(a);
        }

        if (endContainer.tagName == 'A') {
            $(nodeB).insertAfter(endContainer);  
            a.insertAfter(endContainer);
            $(nodeA).insertAfter(endContainer);  
        } else {
            // winAlert(range.commonAncestorContainer.outerHTML + '-' + endData + '-' + endContainer.outerHTML)
            if (endData) {
                var newRange1 = document.createRange();
                newRange1.setStartAfter(endContainer);
                newRange1.insertNode(nodeB);
                newRange1.insertNode(a[0]);
                newRange1.insertNode(nodeA);
                selection.removeAllRanges();
                selection.addRange(newRange1);
                endContainer.data = '';
            } else {
                range.insertNode(nodeB);
                range.insertNode(a[0]);
            }
            // winAlert(document.body.innerHTML)
        }

        var newRange = document.createRange();
        selection.removeAllRanges();
        newRange.setStart(nodeB, 1);
        newRange.setEnd(nodeB, 1);
        selection.addRange(newRange);
        
        var joinedArguments = ZSSEditor.getJoinedFocusedFieldIdAndCaretArguments();
        this.callback("input", joinedArguments);
        ZSSEditor.selectionChangedCallback();
    }
}
ZSSField.prototype.cancelAt = function () { 
    var selecion = window.getSelection();
    var range = selecion.getRangeAt(0);
    var obj = range.startContainer;
    var theLink;
    if (this.isLinkAt(obj)) {
        theLink = obj
    } else if(this.isLinkAt($(obj).closest('a')[0])){
        theLink = $(obj).closest('a')[0];
    }
    if (theLink) {
        var textNode = document.createTextNode(theLink.innerText);
        $(textNode).insertBefore(theLink);
        var newRange = document.createRange();
        newRange.setStart(textNode, range.startOffset);
        newRange.setEnd(textNode, range.endOffset);

        $(theLink).remove();
        selecion.removeAllRanges();
        selecion.addRange(newRange);

        return true;
    }
}

ZSSField.prototype.checkLinkHref = function (id) { 
    var link = $('#link' + id);
    var href = link.attr('href');
    var _this = this;

    function success (result) {
        if (result.err_no == 0 && result.link_data.is_legal == 1){    
            var trueLink = document.createElement('a');
            trueLink.className = 'out-link';
            trueLink.href = href;
            trueLink.target = '_blank';
            // trueLink.innerHTML = result.title;
            trueLink.innerHTML = result.link_data.title || href;
            trueLink.id = 'link' + id;

            $(trueLink).insertBefore(link);
            var text = link.text().split(' ');
            var zeroWord = '\xa0';
            if (text.length > 1) {
                zeroWord += text.slice(1).join(' ');
            }
            var zeroWidthWord = document.createTextNode(zeroWord);
            $(zeroWidthWord).insertBefore(link);
            var selection = window.getSelection();
            var _range = selection.getRangeAt(0);
            var resetRange = _this.isEmptyRange(_range) && _range.startContainer.previousSibling && _this.isOutLink(_range.startContainer.previousSibling);
            link.remove();    
            if (resetRange) {
                var range = document.createRange();
                range.setStart(zeroWidthWord, zeroWord.length);
                range.setEnd(zeroWidthWord, zeroWord.length);
                selection.removeAllRanges();
                selection.addRange(range);
            }
        } else {
            var textNode = document.createTextNode(link.text());
            $(textNode).insertBefore(link);
            link.remove();
        }
    }
    $.ajax({
        url: 'https://lf.snssdk.com/wenda/v1/link/check/',
        type: 'GET',
        dataType: 'json',
        data: {
            link:href
        },
        success: success
    });
    
    // setTimeout(function () {
    //     success({err_no:0, link_data:{is_legal: 1 }})
    // }, 100);
}

var longTapTimer = undefined,editingLinkID = undefined,touchingLinkID = undefined;
ZSSField.prototype.touchStart = function (ev) { 
    ev = ev.originalEvent;
    var touches = ev.touches;
    if (touches.length >1) {
        clearTimeout(longTapTimer);
        touchingLinkID = undefined;
        return;
    }
    var target = ev.target;
    var linkTip = $(target).parents('.link-edit-tip');
    if (!linkTip.length) {
        $('.link-edit-tip').remove();
        $('.editing').removeClass('editing');
        // return;
    }
    if (!/^link\d+$/i.test(ev.target.id) || ev.target.tagName !== 'A') {
        return;
    }
    touchingLinkID = ev.target.id;
    clearTimeout(longTapTimer);
    longTapTimer = setTimeout(function () { 
        this.popupLinkEditTip(ev.target.id);
        touchingLinkID = undefined;
        this.callback('showEdit');

        // window.getSelection().removeAllRanges();
    }.bind(this), 800);
    ev.preventDefault();
}

ZSSField.prototype.clickOutLink = function (ev) { 
    var id = $(ev.target).attr('id');
    this.popupLinkEditTip(id);
}
ZSSField.prototype.popupLinkEditTip = function (id) { 
    $('.link-edit-tip').remove();
    $('.editing').removeClass('editing');
    var link = $('#' + id);
    var offset = link.offset();
    var tip_width = 140;

    var tip = $('<div class="link-edit-tip" data-id="' + id + '"><div class="triangle"></div><span class="tip-open">打开</span><i></i><span class="tip-edit">编辑</span><i></i><span class="tip-del">删除</span></div>');
    var left = offset.left + link.width() / 2 - tip_width / 2;
    var triangleOffset = 0;
    if (left < 5) {
        triangleOffset = left - 5;
        left = 5;
    } else {
        var windowWidth = $(window).width();
        var maxRight = windowWidth - 5;
        if (left + tip_width > maxRight) {
            triangleOffset = left + tip_width - maxRight;
            left = maxRight - tip_width;
        }
    }
    tip.css('left', left + 'px');
    if (triangleOffset) {
        tip.find('.triangle').css('transform', 'translate(' + triangleOffset + 'px,0)');
    }
    tip.css('top', offset.top + link.height() + 11 + 'px');
    tip.appendTo('body');
    link.addClass('editing')
}
ZSSField.prototype.handleClick = function (ev) { 
    var target = ev.target;
    if ($(target).is('.out-link')) {
        var id = $(ev.target).attr('id');
        this.popupLinkEditTip(id);
        ev.preventDefault();
        return;
    }
    var linkTip = $(target).parents('.link-edit-tip');
    var id = linkTip.attr('data-id');
    var link = $('#' + id);
    if (linkTip.length && target.tagName == 'SPAN') {
        if (target.className == 'tip-edit') {
            editingLinkID = id;
            setTimeout(function () { 
                ZSSEditor.callback('editLink', ['text=',link.text(),defaultCallbackSeparator,'link=',link.attr('href')].join(''));
                linkTip.remove();
            }, 400);
        }
        if (target.className == 'tip-del') {
            $('#' + id).remove();
            $('.link-edit-tip').remove();
            $('.editing').removeClass('editing');
            this.emptyFieldIfNoContents();

            setTimeout(function () { 
                linkTip.remove();
            }, 400);
        }
        if (target.className == 'tip-open') {
            var href = link.attr('href');
            var title = link.text();

            $('.link-edit-tip').remove();
            $('.editing').removeClass('editing');

            location.href = 'sslocal://webview?url=' + encodeURIComponent(href) + '&title=' + encodeURIComponent(title);
        }
    } else {
        $('.link-edit-tip').remove();
        $('.editing').removeClass('editing');
    }
    
    if(!isUsingAndroid && target.tagName === 'BODY'){
	    this.focusRangeEnd(true);
	    this.focus();
    }
}

ZSSField.prototype.touchEnd = function (ev) { 
    clearTimeout(longTapTimer);
    ev = ev.originalEvent;
    if (ev.touches.length > 0) {
        touchingLinkID = undefined;
        return;
    }
    if (ev.target.id == touchingLinkID) {
        var $this = $(ev.target);
        var href = $this.attr('href');
        var title = $this.text();

        location.href = 'sslocal://webview?url=' + encodeURIComponent(href) + '&title=' + encodeURIComponent(title);
    }
}
ZSSEditor.setLink = function (code,link,text) {
    if (code == 1) {
        var $link = $('#' + editingLinkID);
        $link.attr('href', link);
        $link.html(text);
    }
}
/*
* 发表前，由客户端调用，判断当前编辑器内容状态：
* ret = 0 无任何内容
* ret = 1 只有文字
* ret = 2 只有图片
* ret = 3 同时包含文字和图片
*/
ZSSField.prototype.getEditorStatus = function() {
    var txt = this.wrappedObject.text().replace(/[\s\u00a0\u200b]/g,''),
        txt_status = txt.length ? 1 : 0,
        img_status = this.wrappedObject.find('img').length ? 2 : 0;

    /**
     * tip：单个视频允许发布
     * 增加视频如何含有文本
     * **/
    txt_status = this.wrappedObject.find('video').length ? 1 : txt_status ;

    return txt_status + img_status;
};

ZSSField.prototype.getEditorStatusForCallback = function(){
    var functionArgument = "function=getEditorStatusForCallback";
    var idArgument = "id=" + this.getNodeId();
    var contentsArgument = "contents=" + this.getEditorStatus();
    var joinedArguments = functionArgument + defaultCallbackSeparator + idArgument + defaultCallbackSeparator +
        contentsArgument;
    ZSSEditor.callback('responseString', joinedArguments);
};

/*
* 由客户端调用，返回当前编辑器文本内容：
*/
ZSSField.prototype.getEditorText = function() {
    var txt = this.wrappedObject.text().replace(/[\s\u00a0\u200b]/g,'');
	
	/** 仅有视频允许发布 **/
	if(!txt && this.wrappedObject.find('video').length){
		txt = 'video:';
	}
    
    return txt;
};

ZSSField.prototype.getEditorTextForCallback = function(){
    var functionArgument = "function=getEditorTextForCallback";
    var idArgument = "id=" + this.getNodeId();
    var contentsArgument = "contents=" + this.getEditorText();
    var joinedArguments = functionArgument + defaultCallbackSeparator + idArgument + defaultCallbackSeparator +
        contentsArgument;
    ZSSEditor.callback('responseString', joinedArguments);
};

//编辑器页面日夜间模式设置
ZSSEditor.setDayMode = function(flag){
    if(["0","1",0,1].indexOf(flag) < 0 ) return;
    var $body = $(document.body);
    flag = parseInt(flag);
    flag ? $body.removeClass('night') : $body.addClass('night');
};

/*
* android 5.0以下的“部分”设备webview存在bug：软键盘上的退格删除键会跳过<img>元素，导致插入的<img>无法删除。且前端无法监听到软键盘的退格删除事件
* 需要客户端监听用户按下退格删除事件，然后执行js回调函数，在其中判断是否需要删掉<img>标签
*/
ZSSEditor.deleteImageWhenPressDownBackspaceIfNecessary = function(){
    var self = window.getSelection();
    if(self.rangeCount){
        var range = self.getRangeAt(0),
            endCon = range.endContainer,
            endPos = range.endOffset;
        if(endCon.nodeType == 1 && endPos > 0){
            var curNode = endCon.childNodes[endPos-1];
            if(curNode.nodeName.toLowerCase() == 'img'){
                endCon.removeChild(curNode);
            }
        }
    }
};

ZSSEditor.deleteVideoWhenPressDownBackspaceIfNecessary= function(){
    var self = window.getSelection();
    if(self.rangeCount){
        var range = self.getRangeAt(0),
            endCon = range.endContainer,
            endPos = range.endOffset;
        if(endCon.nodeType == 1 && endPos > 0){
            var curNode = endCon.childNodes[endPos-1];
            if(curNode.nodeName.toLowerCase() == 'video'){
                endCon.removeChild(curNode);
            }
        }
    }
};

/*
* 为客户端提供页面滚动接口
*/
ZSSEditor.scrollTop = function(yOffset){
    window.scrollTo(0, yOffset);
}

ZSSEditor.keyboardPopUp = function () { 
    var caretInfo = this.getYCaretInfo();

    var height = $(window).height();
    var y = caretInfo.y;
    y = y - height + caretInfo.height + 5;
    this.scrollTop(y);
}




filterRules=function(){
    function transP(node){
        node.tagName = 'p';
        node.attrs={};
        node.style="";
    }
    return {
        //直接删除及其字节点内容
        'script':'-',
        'style':'-',
        'object':'-',
        'iframe':'-',
        'meta':'-',
        'embed':'-',
        'input':'-',
        'select':'-',
        'p': {'span':0, $:{}},
        'span':{'$':{}},
        'div':{'$':{}},
        'img':{'$':{ 'src':1, 'id':1 }},
        'strong':{'$':{}},
        'ul':{'$':{}},
        'u':{'$':{}},
        'ol':{'$':{}},
        'li':{'p':0, '$':{}},
        // 'table':{'$':{}},'thead':{'$':{}},'tbody':{'$':{}},'th':{'$':{}},'tr':{'$':{}},'td':{'$':{}},
        'blockquote':{$:{}}, 'code':{$:{}},
        'h1':{'$':{}},
    };
}();

function isFunction(fn) {
    return (!!fn&&!fn.nodename&&fn.constructor!=String&&fn.constructor!=RegExp&&fn.constructor!=Array&&/function/i.test(fn+""));
}

function getNodeIndex(node, ignoreTextNode) {
        var preNode = node,
            i = 0;
        while (preNode = preNode.previousSibling) {
            if (ignoreTextNode && preNode.nodeType == 3) {
                if (preNode.nodeType != preNode.nextSibling.nodeType) {
                    i++;
                }
                continue;
            }
            i++;
        }
        return i;
}
// 黏贴过滤器

function filterNode(node){
    switch (node.nodeType) {
        case 3:
            break;
        case 1:
            var name = node.tagName.toLowerCase();
            var val;
            if(val = filterRules[name]){
                if(val=='-'){
                    node.parentNode.removeChild(node);
                }else{
                    var bold=0;
                    var underline=0;
                    if(node.style.fontWeight=="bold"){
                        bold=1;
                    }
                    if(node.style.textDecoration=="underline"){
                        underline=1;
                    }
                    node.setAttribute("style","");
                    if(bold){
                        node.style.fontWeight="bold";
                    }
                    if(underline){
                        node.style.textDecoration="underline";
                    }
                    if(node.childNodes.length>0){
                        for(var i = 0,ci;ci=node.children[i];){
                            filterNode(ci,filterRules);
                            if(ci.parentNode){
                                i++;
                            }
                        }
                    }
                }
            }
    return node;
    }
}



// ios10  以上会focus在视频内部
// if(/iPhone/.test(navigator.userAgent)){
$(document).on('click',"video",function(){
  ZSSEditor.$editor.blur();
});
// }

ZSSEditor.marginTop = function (topMargin) {
    ZSSEditor.$editor.css('margin-top', topMargin + 'px');
};




// 给安卓提供的点击回调
$(document).on('click',function(){
    ZSSEditor.viewPortClickCallback();
});

ZSSEditor.viewPortClickCallback = function () {
    var joinedArguments = '';
    this.callback('clickViewport', joinedArguments);
};



// 视频删除按键
$(document).on('click','.delete-icon',function(e){
    var $this = $(this);
    var v = $this.next()[0];
    if(v.tagName == 'VIDEO'){
        var vid = $(v).attr('data-vid');
        ZSSEditor.deleteVideoById(vid);
    }
});

function winAlert(arg) {
    setTimeout(function () { 
        alert(arg);
    }, 100);
};

ZSSEditor.insertVideo = function(url,vid,poster_local,poster_online) {
    //新的图片插入解决方案，前后<br>换行
    var self = window.getSelection();
    if(self.rangeCount < 1) return;
    //
    var that = this,
    currentField = this.getFocusedField();
    currentField.wrapCaretInParagraphIfNecessary();

    var fragment = document.createDocumentFragment('div'),
    before_br = document.createElement('br'),
    after_br = document.createElement('br'),
    video = document.createElement('video');
    var zeroWidthWord = document.createTextNode('\u200b');
    var deleteBtn = document.createElement('i');
    var range = self.getRangeAt(0).cloneRange();
    var startNode = range.startContainer;
    setTimeout(function(){
        if(startNode.nodeType == 3 && range.startOffset != 0){
            fragment.appendChild(before_br);
        }
        before_text = document.createElement('p');
        before_text.innerHTML = "video:";
        before_text.className = 'video_placeholder';   //占位符
        before_text.style.display = "none";
        deleteBtn.className = 'delete-icon';
        deleteBtn.setAttribute("data-node",'delete-video'); 
        deleteBtn.setAttribute("contenteditable",false);
        video.setAttribute("contenteditable",false); 
        video.setAttribute("poster",poster_local); 
        video.setAttribute("data-poster",poster_online); 
        video.setAttribute("data-vid",vid);   
        video.setAttribute("controls",true);
        fragment.appendChild(before_text);
        fragment.appendChild(deleteBtn);
        fragment.appendChild(video);
        // fragment.appendChild(after_br);
        // fragment.appendChild(zeroWidthWord);
        video.src = url;

        // alert(123);
        var afterDom = range.endContainer;
        if ($(afterDom).closest('a').length) {
            afterDom = $(afterDom).closest('a');
            if ($.contains(currentField.wrappedObject[0],afterDom[0])) {
                $(fragment).insertAfter(afterDom);
            } else {
                $(fragment).appendTo(currentField.wrappedObject);
            }
        } else {
            range.insertNode(fragment);
        }

        var $p = $('<p>\u200b</p>');
        $p.insertAfter($(video.parentNode));
        
        
        range.selectNodeContents($p[0]);
        range.collapse(true);
        self.removeAllRanges();
        self.addRange(range);

    

        //安卓平台不能自动滚动到光标位置，需前端主动scroll页面
        if(isUsingAndroid){
            var top = video.offsetTop,
                height = video.offsetHeight,
                scroll = top + height;

            setTimeout(function(){
                //此处必须设置超时，否则，不能按预期scrollTo
                window.scrollTo(0, scroll);
            },300);
        }
        that.sendEnabledStyles();

        var joinedArguments = ZSSEditor.getJoinedFocusedFieldIdAndCaretArguments();
    
        this.callback('selectionChanged', joinedArguments);
        that.callback("input", joinedArguments);
    },50);

    return;
};


//客户端通过此接口加载本地保存的草稿
ZSSField.prototype.setHTML = function(html, focusToEnd) {
    //var mutatedHTML = wp.loadText(html);
    var mutatedHTML = this.processHTML(html);

    this.wrappedObject.html(mutatedHTML);

    //加载草稿后调整光标输入起始位置
    var editor = this.wrappedObject[0],
        self = window.getSelection(),
        range = document.createRange(),
        zeroWidthWordReg = /^[\s\u00a0\u200b]$/,
        lastNode = editor.lastChild,
        needAddBrAndZeroWord = false;

    if(focusToEnd && lastNode){
        //if(!lastNode) return;

        var userSimpleCaretAdjust = false;

        if(userSimpleCaretAdjust){
            //把光标简单定位到编辑器末尾，不考虑最后有效内容是图片时，光标自动换行
            range.selectNodeContents(editor);
            range.setStartAfter(editor.lastChild);
        }else{
            //精细化光标定位到编辑器末尾，如果最后有效内容是图片，要考虑光标在图片后自动换行

            switch(lastNode.nodeType){
                case 1:
                    adjustLastNode(lastNode);
                    break;
                case 3:
                    var nodeValue = lastNode.nodeValue,
                        preEle = null;

                    while(nodeValue && nodeValue.length == 1 && zeroWidthWordReg.test(nodeValue)){
                        preEle = lastNode.previousSibling;
                        nodeValue = preEle ? preEle.nodeValue : '';
                    }
                    if(preEle && preEle.nodeType == 1){
                        adjustLastNode(preEle);
                    }
                    break;
            }

            if(needAddBrAndZeroWord){
                lastNode.insertAdjacentHTML('afterend','<br>\u200b');
                var nt = lastNode.nextSibling.nextSibling;
                range.selectNodeContents(nt);
                range.collapse(true);
            }else{
                range.selectNodeContents(editor);
                range.setStartAfter(editor.lastChild);
            }
        }
        self.removeAllRanges();
        self.addRange(range);
    }else{
        //输入光标定位到编辑器顶部
        var firstNode = editor.firstChild;
        if(firstNode){
            range.selectNodeContents(firstNode);
            range.collapse(true);
            self.removeAllRanges();
            self.addRange(range);
        }
    }

    addVideoCloseBtn();

    function adjustLastNode(ele){
        if(ele.nodeType != 1) return;

        var name = ele.nodeName.toLowerCase();
        if(name == 'img'){
            needAddBrAndZeroWord = true;
            lastNode = ele;
        }else{
            var _end = ele.lastChild;
            if(_end){
                var _name = _end.nodeName.toLowerCase();
                if(_name == 'img'){
                    lastNode = _end;
                    needAddBrAndZeroWord = true;
                }else if(_name == '#text' && zeroWidthWordReg.test(_end.nodeValue)){
                    var _preEle = _end.previousSibling,
                        _value = _preEle.nodeValue;
                    while(_value && _value.length == 1 && zeroWidthWordReg.test(_value)){
                        _preEle = _preEle.previousSibling;
                        _value = _preEle ? _preEle.nodeValue : '';
                    }

                    if(_preEle && _preEle.nodeName.toLowerCase() == 'img'){
                        lastNode = _preEle;
                        needAddBrAndZeroWord = true;
                    }
                }
            }
        }
    }
};

// MARK: - Placeholder

function addVideoCloseBtn(){
    $('video').each(function(i,item){
        var $d = $('<i class="delete-icon" data-node="delete-video" contenteditable="false"></i>');
        $d.insertBefore($(item));
    });
}




ZSSEditor.deleteVideoById = function(vid){
    var $video = $('[data-vid="'+vid+'"]');
    var $pre = $video.prev();
    var $pre_pre = $video.prev().prev();
    if($pre.hasClass("video_placeholder") || $pre.data('node')=='delete-video'){
        $pre.remove();
        // 删掉占位的div
    }
    if($pre_pre.hasClass("video_placeholder") || $pre_pre.data('node')=='delete-video'){
        $pre_pre.remove();
         // 删掉删除按钮
    }
    var $next = $video.next();
    if($next[0]){
        if($next[0].nodeName == "BR" || $next[0].nodeValue == ""){
            $next.remove();
        }
    }
    $video.remove();
   
}


// 视频删除按键
$(document).on('click','.delete-icon',function(e){
    var $this = $(this);
    var v = $this.next()[0];
    if(v.tagName == 'VIDEO'){
        var vid = $(v).attr('data-vid');
        ZSSEditor.deleteVideoById(vid);
    }
});
$(document).on('touchend','.delete-icon',function(e){
    var $this = $(this);
    var v = $this.next()[0];
    if(v.tagName == 'VIDEO'){
        var vid = $(v).attr('data-vid');
        ZSSEditor.deleteVideoById(vid);
    }
});;