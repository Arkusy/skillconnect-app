import { createClient } from 'jsr:@supabase/supabase-js@2'

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  record: any
  schema: 'public'
  old_record: null | any
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  const payload: WebhookPayload = await req.json()

  console.log('Webhook received:', payload.type, payload.table)

  // Get worker's push token from profiles
  const { data, error } = await supabase
    .from('profiles')
    .select('expo_push_token, full_name')
    .eq('id', payload.record.worker_id)
    .single()

  if (error || !data?.expo_push_token) {
    console.log('No push token found for worker:', payload.record.worker_id)
    return new Response(
      JSON.stringify({ error: 'No push token found' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  console.log('Sending notification to:', data.expo_push_token)

  // Send push notification using Expo's API with access token
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('EXPO_ACCESS_TOKEN')}`,
    },
    // Around line 45-54, update the notification payload:
    body: JSON.stringify({
      to: data.expo_push_token,
      sound: 'default',
      title: 'New Order Received! 🚀',
      body: `You have a new request from ${payload.record.customer_name}.`,
      priority: 'high',           // Add this
      channelId: 'default',       // Add this
      data: {
        orderId: payload.record.id,
        screen: 'DisplayOrder'
      }
    }),

  }).then((res) => res.json())

  console.log('Expo API response:', res)

  return new Response(
    JSON.stringify(res),
    { headers: { 'Content-Type': 'application/json' } }
  )
})