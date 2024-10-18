pub mod constants;
pub use constants::*;

pub mod instructions;
pub use instructions::*;

pub mod state;
pub use state::*;

pub mod error;

use anchor_lang::prelude::*;

declare_id!("2xSfSmcDi39CegZvhc5qzzb4M63BMF76fkBaN1GqhAsj");

#[program]
pub mod swap {

    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        initialize::handler(ctx)
    }

    pub fn make_offer(
        context: Context<MakeOffer>,
        id: u64,
        token_a_offerd_amount: u64,
        token_b_wanted_amount: u64,
    ) -> Result<()> {
        make_offer::send_offered_tokens_to_valut(&context, token_a_offerd_amount)?;
        make_offer::save_offer(context, id, token_b_wanted_amount)?;
        Ok(())
    }

    pub fn take_offer(context: Context<TakeOffer>) -> Result<()> {
        take_offer::send_wanted_token_to_maker(&context)?;
        take_offer::withdraw_and_close_vault(&context)?;
        Ok(())
    }
}
