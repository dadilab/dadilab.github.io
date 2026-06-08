{{ 
  (() => {
    // 定义要渲染的最大条数（原代码是10条）
    const maxCount = $json.time.length;
    // 存储拼接后的HTML片段
    const htmlParts = [];
    
    // 循环遍历0到maxCount-1的索引
    for (let i = 0; i < maxCount; i++) {
      // 容错：如果某条数据不存在，跳过或显示默认值
      if (!($json.time[i] && $json.link[i] && $json.title[i])) {
        // 可选：跳过空数据，或替换为默认行
        // htmlParts.push(`无数据-${i+1}|无链接`);
        continue;
      }
      
      // 拼接单条数据的HTML
      htmlParts.push(`<li><span>${$json.time[i]}>{{ $workflow.name }}|</span><a href="${$json.link[i]}" target="_blank">${i+1}.${$json.title[i]}</a><br/></li>`);
    }
    
    // 用换行符连接所有片段，返回最终HTML
    return htmlParts.join('\n');
  })() 
}}
