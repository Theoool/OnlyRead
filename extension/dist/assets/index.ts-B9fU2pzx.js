chrome.action.onClicked.addListener(e=>{e.id&&chrome.tabs.sendMessage(e.id,{type:"TOGGLE_READER"})});
