import { FetchClient, Config } from 'coze-coding-dev-sdk';
import * as fs from 'fs';
import * as path from 'path';

const config = new Config();
const client = new FetchClient(config);

async function main() {
  console.log('正在读取 PDF 文档...');
  
  // Try with file:// protocol
  const absPath = path.resolve('/tmp/multifactor.pdf');
  const fileUrl = `file://${absPath}`;
  console.log('Trying file URL:', fileUrl);
  
  const response = await client.fetch(fileUrl);
  
  console.log(`\n标题：${response.title}`);
  console.log(`状态：${response.status_code === 0 ? '成功' : '失败'}`);
  console.log(`文件类型：${response.filetype}`);
  console.log('\n--- 文档内容 ---\n');
  
  if (response.content && response.content.length > 0) {
    const textContent = response.content
      .filter(item => item.type === 'text')
      .map(item => item.text)
      .join('\n');
    console.log(textContent);
  } else {
    console.log('No content returned');
    console.log('Full response:', JSON.stringify(response, null, 2).substring(0, 2000));
  }
}

main().catch(console.error);
