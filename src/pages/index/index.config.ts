export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '图片转PDF工具',
      navigationBarBackgroundColor: '#ffffff',
      navigationBarTextStyle: 'black',
    })
  : {
      navigationBarTitleText: '图片转PDF工具',
      navigationBarBackgroundColor: '#ffffff',
      navigationBarTextStyle: 'black',
    };