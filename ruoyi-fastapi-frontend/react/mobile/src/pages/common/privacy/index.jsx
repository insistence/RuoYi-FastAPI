import React from "react";
import { View, Text, Input, Image, ScrollView } from "@tarojs/components";
export default function Privacy() {
  return (
    <View className="min-h-full bg-white px-5 py-8">
      <View className="mb-6 text-center">
        <Text className="text-xl font-bold text-gray-900">隐私协议</Text>
      </View>

      <View className="space-y-6 text-justify text-sm leading-relaxed text-gray-600">
        <View>
          <Text>
            RuoYi-FastAPI非常重视您的隐私保护。本隐私政策旨在向您说明我们如何收集、使用、存储和保护您的个人信息。请您在使用本产品前仔细阅读本政策。
          </Text>
        </View>

        <View>
          <Text className="mb-2 block font-bold text-gray-800">
            1. 我们如何收集和使用您的个人信息
          </Text>
          <Text>为了向您提供更好的服务，我们可能会收集您的以下信息：</Text>
          <Text className="mt-1 block pl-2">
            •
            账号信息：当您注册或登录时，我们需要收集您的用户名、密码、手机号码等信息。
          </Text>
          <Text className="mt-1 block pl-2">
            •
            设备信息：为了保障账户安全和优化服务，我们会收集您的设备型号、操作系统版本、唯一设备标识符等信息。
          </Text>
          <Text className="mt-1 block pl-2">
            •
            日志信息：当您使用本产品时，我们会自动收集您的操作日志、IP地址、访问时间等信息。
          </Text>
        </View>

        <View>
          <Text className="mb-2 block font-bold text-gray-800">
            2. 我们如何共享、转让、公开披露您的个人信息
          </Text>
          <Text>
            我们不会向任何第三方共享、转让或公开披露您的个人信息，但以下情况除外：
          </Text>
          <Text className="mt-1 block pl-2">• 获得您的明确授权或同意；</Text>
          <Text className="mt-1 block pl-2">
            • 根据法律法规或司法机关的要求；
          </Text>
          <Text className="mt-1 block pl-2">
            • 为了维护国家安全、公共安全或重大公共利益。
          </Text>
        </View>

        <View>
          <Text className="mb-2 block font-bold text-gray-800">
            3. 我们如何保护您的个人信息
          </Text>
          <Text>
            我们采取了多种安全措施来保护您的个人信息，包括数据加密、访问控制、安全审计等。我们会尽力防止您的信息被未经授权的访问、篡改或泄露。
          </Text>
        </View>

        <View>
          <Text className="mb-2 block font-bold text-gray-800">
            4. 您的权利
          </Text>
          <Text>
            您有权访问、更正或删除您的个人信息。您也可以随时注销账号。如您需要行使这些权利，请通过“联系我们”章节中的方式与我们联系。
          </Text>
        </View>

        <View>
          <Text className="mb-2 block font-bold text-gray-800">
            5. 本政策如何更新
          </Text>
          <Text>
            随着法律法规的变化或业务的发展，我们可能会不时更新本隐私政策。更新后的政策将在本产品中发布，并在生效前通过适当方式通知您。
          </Text>
        </View>

        <View>
          <Text className="mb-2 block font-bold text-gray-800">
            6. 联系我们
          </Text>
          <Text>
            如果您对本隐私政策有任何疑问或建议，请通过以下方式联系我们：
          </Text>
          <Text className="mt-1 block">邮箱：xxx@xxx.com</Text>
        </View>
      </View>

      <View className="mt-10 text-center text-xs text-gray-400">
        <Text>更新日期：2024年01月01日</Text>
      </View>
    </View>
  );
}
